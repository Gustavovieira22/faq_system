import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PESOS_CAMPOS,
    SCORE_MINIMO,
    buscarPorRelevancia,
    htmlParaTexto,
    normalizarTexto,
    tokenizar
} from '../src/utils/buscaRelevancia.js';

function criarPerguntasNeutras(quantidade, prefixoId = 100) {
    return Array.from({ length: quantidade }, (_, indice) => ({
        id: prefixoId + indice,
        titulo: `Procedimento interno ${prefixoId + indice} de rotina`,
        resposta: `<p>Conteudo padrao numero ${prefixoId + indice} sem os termos pesquisados.</p>`,
        copias: 0
    }));
}

test('pesos dos campos seguem a regra 70% titulo / 30% conteudo', () => {
    assert.equal(PESOS_CAMPOS.titulo, 0.7);
    assert.equal(PESOS_CAMPOS.conteudo, 0.3);
});

test('normalizacao remove acentos, caixa e pontuacao', () => {
    assert.equal(normalizarTexto('Matrícula  Ágil!!!'), 'matricula agil');
    assert.deepEqual(
        tokenizar('Como emitir a 2ª via do boleto?'),
        ['emitir', '2', 'via', 'boleto']
    );
});

test('htmlParaTexto descarta tags, scripts e decodifica entidades', () => {
    const texto = htmlParaTexto(
        '<p>Segunda <strong>via</strong> &amp; boleto&nbsp;PIX</p><script>alert(1)</script>'
    );

    assert.match(texto, /Segunda\s+via\s+&\s+boleto\s+PIX/);
    assert.doesNotMatch(texto, /<|>|strong|script|alert/);
});

test('consulta vazia, sem termos uteis ou acervo vazio nao retorna resultados', () => {
    const perguntas = criarPerguntasNeutras(5);

    assert.deepEqual(buscarPorRelevancia([], 'boleto'), []);
    assert.deepEqual(buscarPorRelevancia(perguntas, '   '), []);
    assert.deepEqual(buscarPorRelevancia(perguntas, 'como para de'), []);
    assert.deepEqual(buscarPorRelevancia(perguntas, '????'), []);
});

test('campo nulo ou ausente nao quebra a busca', () => {
    const resultados = buscarPorRelevancia([
        { id: 1, titulo: null, resposta: null, copias: 0 }
    ], 'boleto');

    assert.deepEqual(resultados, []);
});

test('termo no titulo vale mais que o mesmo termo apenas no corpo', () => {
    const perguntas = [
        { id: 1, titulo: 'Emissao de boleto', resposta: '<p>Veja o passo a passo.</p>', copias: 0 },
        { id: 2, titulo: 'Passo a passo', resposta: '<p>Emita o boleto pelo portal.</p>', copias: 0 },
        ...criarPerguntasNeutras(10)
    ];

    const resultados = buscarPorRelevancia(perguntas, 'boleto');

    assert.equal(resultados.length, 2);
    assert.equal(resultados[0].id, 1);
    assert.equal(resultados[1].id, 2);

    //mesma cobertura, campos diferentes: a razao deve refletir 0,7 / 0,3
    const razao = resultados[0].score / resultados[1].score;
    assert.ok(Math.abs(razao - (PESOS_CAMPOS.titulo / PESOS_CAMPOS.conteudo)) < 0.02);
});

test('busca encontra termos apenas no corpo HTML da resposta', () => {
    const perguntas = [
        {
            id: 7,
            titulo: 'Solicitacao de documento',
            resposta: '<p>O <strong>protocolo</strong> fica disponivel no portal.</p>',
            copias: 0
        },
        ...criarPerguntasNeutras(8)
    ];

    const resultados = buscarPorRelevancia(perguntas, 'protocolo');

    assert.equal(resultados.length, 1);
    assert.equal(resultados[0].id, 7);
    assert.ok(resultados[0].score >= SCORE_MINIMO);
});

test('resultados sao ordenados pela quantidade de termos encontrados', () => {
    const perguntas = [
        { id: 1, titulo: 'Segunda via de boleto', resposta: '<p>Passo a passo.</p>', copias: 0 },
        { id: 2, titulo: 'Boleto', resposta: '<p>Passo a passo.</p>', copias: 0 },
        { id: 3, titulo: 'Segunda via', resposta: '<p>Passo a passo.</p>', copias: 0 },
        ...criarPerguntasNeutras(10)
    ];

    const resultados = buscarPorRelevancia(perguntas, 'segunda via boleto');

    assert.deepEqual(resultados.map((pergunta) => pergunta.id), [1, 3, 2]);
});

test('palavra generica presente em todos os FAQs nao gera resultados', () => {
    const perguntas = Array.from({ length: 30 }, (_, indice) => ({
        id: indice + 1,
        titulo: `Atendimento ao aluno ${indice + 1}`,
        resposta: '<p>Informacoes gerais de atendimento.</p>',
        copias: 0
    }));

    assert.deepEqual(buscarPorRelevancia(perguntas, 'aluno'), []);
});

test('palavra generica combinada com termo especifico filtra os irrelevantes', () => {
    const perguntas = [
        ...Array.from({ length: 30 }, (_, indice) => ({
            id: indice + 1,
            titulo: `Atendimento ao aluno ${indice + 1}`,
            resposta: '<p>Informacoes gerais de atendimento.</p>',
            copias: 0
        })),
        {
            id: 31,
            titulo: 'Boleto do aluno',
            resposta: '<p>Como emitir a segunda via.</p>',
            copias: 0
        },
        {
            id: 32,
            titulo: 'Carteirinha',
            resposta: '<p>Solicitacao da carteirinha.</p>',
            copias: 0
        }
    ];

    const resultados = buscarPorRelevancia(perguntas, 'aluno boleto');

    assert.deepEqual(resultados.map((pergunta) => pergunta.id), [31]);
});

test('busca ignora acentos, caixa e aceita prefixo/plural', () => {
    const perguntas = [
        { id: 1, titulo: 'Matrícula 2026', resposta: '<p>Calendario academico.</p>', copias: 0 },
        ...criarPerguntasNeutras(5)
    ];

    for (const consulta of ['matricula', 'MATRÍCULA', 'matric', 'matriculas']) {
        const resultados = buscarPorRelevancia(perguntas, consulta);

        assert.equal(resultados.length, 1, `consulta: ${consulta}`);
        assert.equal(resultados[0].id, 1, `consulta: ${consulta}`);
    }
});

test('nome de tag ou atributo HTML nao e pesquisavel', () => {
    const perguntas = [
        {
            id: 1,
            titulo: 'Segunda via',
            resposta: '<p class="destaque">Boleto <strong>digital</strong></p>',
            copias: 0
        }
    ];

    assert.deepEqual(buscarPorRelevancia(perguntas, 'strong'), []);
    assert.deepEqual(buscarPorRelevancia(perguntas, 'destaque'), []);

    const resultados = buscarPorRelevancia(perguntas, 'digital');
    assert.equal(resultados.length, 1);
});

test('empate de relevancia usa o ranking de copias e depois o id', () => {
    const perguntas = [
        { id: 10, titulo: 'Boleto', resposta: '<p>Segunda via.</p>', copias: 1 },
        { id: 11, titulo: 'Boleto', resposta: '<p>Segunda via.</p>', copias: 5 },
        { id: 12, titulo: 'Boleto', resposta: '<p>Segunda via.</p>', copias: 1 },
        ...criarPerguntasNeutras(5)
    ];

    const resultados = buscarPorRelevancia(perguntas, 'boleto');

    assert.deepEqual(resultados.map((pergunta) => pergunta.id), [11, 10, 12]);
});

test('scores retornados ficam entre o minimo e 1 e em ordem decrescente', () => {
    const perguntas = [
        { id: 1, titulo: 'Segunda via de boleto', resposta: '<p>Portal do aluno.</p>', copias: 0 },
        { id: 2, titulo: 'Boleto', resposta: '<p>Segunda via.</p>', copias: 0 },
        { id: 3, titulo: 'Carteirinha', resposta: '<p>Boleto e segunda via.</p>', copias: 0 },
        ...criarPerguntasNeutras(10)
    ];

    const resultados = buscarPorRelevancia(perguntas, 'boleto segunda via');

    assert.ok(resultados.length >= 3);

    for (let indice = 0; indice < resultados.length; indice++) {
        const score = resultados[indice].score;

        assert.ok(score >= SCORE_MINIMO && score <= 1);
        assert.ok(Number.isFinite(score));

        if (indice > 0) {
            assert.ok(resultados[indice - 1].score >= score);
        }
    }
});
