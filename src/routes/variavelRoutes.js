import { Router } from 'express';
import { listarVariaveis, variavelForm, criarVariavel, atualizarVariavel} from '../controllers/variavelControoler.js';

const router = Router();

router.get('/api/variavel', listarVariaveis);
router.get('/cadastrar/variavel', variavelForm);

router.post('/api/variavel', criarVariavel);
router.put('/api/variavel/:id', atualizarVariavel);

export default router;