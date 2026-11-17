import express, { Router } from 'express';
import {
    listarVariaveis,
    variavelForm,
    criarVariavel,
    atualizarVariavel,
    salvarTabelaVariaveis,
    exportarTabelaVariaveis,
    importarTabelaVariaveis
} from '../controllers/variavelControoler.js';
import { exigirAdmin } from '../middlewares/authMiddleware.js';

const router = Router();

//recebe o arquivo .xlsx como bytes puros (sem depender de multipart)
const receberPlanilha = express.raw({
    type: '*/*',
    limit: '5mb'
});

//mantem as respostas da importacao em JSON mesmo quando o limite de tamanho e estourado
function tratarErroPlanilha(error, req, res, next) {
    if (error?.type === 'entity.too.large') {
        return res.status(413).json({
            erro: 'O arquivo é maior que 5 MB. Envie uma planilha menor.'
        });
    }

    return next(error);
}

router.get('/api/variavel', exigirAdmin, listarVariaveis);
router.get('/cadastrar/variavel', exigirAdmin, variavelForm);

router.post('/api/variavel/tabela/exportar', exigirAdmin, exportarTabelaVariaveis);
router.post('/api/variavel/tabela/importar', exigirAdmin, receberPlanilha, tratarErroPlanilha, importarTabelaVariaveis);

router.post('/api/variavel', exigirAdmin, criarVariavel);
router.put('/api/variavel/tabela', exigirAdmin, salvarTabelaVariaveis);
router.put('/api/variavel/:id', exigirAdmin, atualizarVariavel);

export default router;
