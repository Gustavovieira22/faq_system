// ==========================================================================
// Busca full-text com pontuacao de relevancia
//
// A busca nao usa apenas "contem": o texto e tokenizado, o HTML da resposta e
// descartado, e cada termo recebe um peso conforme a raridade no acervo
// (quanto mais FAQs contem o termo, menos ele diferencia as respostas).
//
// Score final = (0,7 * cobertura do titulo + 0,3 * cobertura do conteudo)
//               * informatividade media dos termos encontrados
//
// A "informatividade" e o que impede que palavras genericas (presentes em
// quase todos os FAQs) gerem resultados: termos assim tem peso proximo de
// zero e o resultado fica abaixo do SCORE_MINIMO.
// ==========================================================================

export const PESOS_CAMPOS = Object.freeze({
    titulo: 0.7,
    conteudo: 0.3
});

//abaixo deste score o resultado e considerado irrelevante para a consulta
export const SCORE_MINIMO = 0.05;

//limites de seguranca para consultas e respostas muito grandes
export const LIMITE_TERMOS_CONSULTA = 12;
export const LIMITE_CARACTERES_CONTEUDO = 20000;

const TAMANHO_MINIMO_TOKEN = 2;
const PESO_CASAMENTO_EXATO = 1;
const PESO_CASAMENTO_PREFIXO = 0.85;
const PESO_CASAMENTO_PREFIXO_INVERSO = 0.7;

//palavras sem poder de diferenciacao dentro de uma pergunta de FAQ.
//Sao removidas da consulta e do indice para nao inflar a relevancia.
const PALAVRAS_IGNORADAS = new Set([
    'a', 'as', 'o', 'os', 'um', 'uma', 'uns', 'umas',
    'de', 'da', 'das', 'do', 'dos', 'em', 'na', 'nas', 'no', 'nos',
    'por', 'pelo', 'pela', 'pelos', 'pelas', 'para', 'pra', 'com', 'sem',
    'que', 'se', 'ao', 'aos', 'e', 'ou', 'mas',
    'sua', 'seu', 'suas', 'seus', 'meu', 'minha', 'meus', 'minhas',
    'este', 'esta', 'estes', 'estas', 'esse', 'essa', 'esses', 'essas',
    'isso', 'isto', 'aquele', 'aquela', 'aquilo',
    'como', 'onde', 'qual', 'quais', 'quando', 'quanto', 'quanta', 'quantos', 'quantas',
    'porque', 'sobre', 'entre', 'ate', 'apos'
]);

const ENTIDADES_HTML = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '-',
    mdash: '-',
    aacute: 'á',
    agrave: 'à',
    acirc: 'â',
    atilde: 'ã',
    eacute: 'é',
    ecirc: 'ê',
    iacute: 'í',
    oacute: 'ó',
    ocirc: 'ô',
    otilde: 'õ',
    uacute: 'ú',
    uuml: 'ü',
    ccedil: 'ç'
};

function decodificarEntidadesHtml(texto) {
    return texto.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (original, codigo) => {
        if (codigo.startsWith('#')) {
            const hexadecimal = codigo[1]?.toLowerCase() === 'x';
            const numero = Number.parseInt(
                codigo.slice(hexadecimal ? 2 : 1),
                hexadecimal ? 16 : 10
            );

            if (Number.isFinite(numero) && numero > 0 && numero <= 0x10ffff) {
                try {
                    return String.fromCodePoint(numero);
                } catch {
                    return ' ';
                }
            }

            return ' ';
        }

        //entidades sao case-sensitive, mas o mapa guarda apenas minusculas
        return ENTIDADES_HTML[codigo] ?? ENTIDADES_HTML[codigo.toLowerCase()] ?? ' ';
    });
}

//converte o HTML salvo pelo editor em texto pesquisavel
export function htmlParaTexto(html) {
    const texto = String(html ?? '')
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|td|th|blockquote|section|article|header|footer|table|thead|tbody)>/gi, ' ')
        .replace(/<[^>]*>/g, ' ');

    return decodificarEntidadesHtml(texto);
}

//remove acentos, pontuacao e diferencas de caixa
export function normalizarTexto(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenValido(token) {
    if (!token || PALAVRAS_IGNORADAS.has(token)) {
        return false;
    }

    //numeros de um digito podem ser importantes ("bloco 2", "periodo 1")
    return token.length >= TAMANHO_MINIMO_TOKEN || /^[0-9]$/.test(token);
}

export function tokenizar(texto) {
    const normalizado = normalizarTexto(texto);

    if (!normalizado) {
        return [];
    }

    return normalizado.split(' ').filter(tokenValido);
}

function contarTokens(texto) {
    const contagem = new Map();

    for (const token of tokenizar(texto)) {
        contagem.set(token, (contagem.get(token) || 0) + 1);
    }

    return contagem;
}

function fatorOcorrencia(quantidade, incremento, teto) {
    //repeticoes aumentam pouco a relevancia (evita "keyword stuffing")
    return Math.min(teto, 1 + incremento * Math.log(quantidade));
}

function obterNumero(objeto, campo) {
    const valor = Number(objeto?.[campo]);
    return Number.isFinite(valor) ? valor : 0;
}

function arredondarScore(score) {
    return Math.round(score * 10000) / 10000;
}

function encontrarCorrespondencias(termo, vocabulario) {
    const correspondencias = [];

    for (const token of vocabulario.keys()) {
        if (token === termo) {
            correspondencias.push({ token, pesoCasamento: PESO_CASAMENTO_EXATO });
            continue;
        }

        //consulta parcial: "bolet" encontra "boleto"
        if (token.startsWith(termo)) {
            correspondencias.push({ token, pesoCasamento: PESO_CASAMENTO_PREFIXO });
            continue;
        }

        //plural/variação digitada pelo usuario: "boletos" encontra "boleto"
        if (termo.length >= 4 && token.length >= 4 && termo.startsWith(token)) {
            correspondencias.push({ token, pesoCasamento: PESO_CASAMENTO_PREFIXO_INVERSO });
        }
    }

    return correspondencias;
}

function calcularIdf(documentosComTermo, totalDocumentos) {
    //IDF no estilo BM25: termos raros tem peso alto; termos presentes em
    //quase todos os documentos tendem a zero.
    return Math.log(
        1 + (totalDocumentos - documentosComTermo + 0.5) / (documentosComTermo + 0.5)
    );
}

/**
 * Executa a busca por relevancia em uma lista de perguntas.
 *
 * @param {Array<object>} documentos perguntas ja com as variaveis substituidas
 * @param {string} consulta texto digitado pelo usuario
 * @param {object} opcoes nomes dos campos de titulo, conteudo, copias e id
 * @returns {Array<object>} documentos com a propriedade `score` (0 a 1),
 *                         ordenados do mais relevante para o menos relevante
 */
export function buscarPorRelevancia(documentos, consulta, opcoes = {}) {
    const {
        campoTitulo = 'titulo',
        campoConteudo = 'resposta',
        campoCopias = 'copias',
        campoId = 'id'
    } = opcoes;

    if (!Array.isArray(documentos) || documentos.length === 0) {
        return [];
    }

    //termos unicos: repetir a mesma palavra na consulta nao aumenta o score
    const termosConsulta = [...new Set(tokenizar(consulta))]
        .slice(0, LIMITE_TERMOS_CONSULTA);

    if (termosConsulta.length === 0) {
        return [];
    }

    const totalDocumentos = documentos.length;

    const preparados = documentos.map((documento) => ({
        documento,
        tituloTokens: contarTokens(documento[campoTitulo]),
        conteudoTokens: contarTokens(
            htmlParaTexto(String(documento[campoConteudo] ?? '').slice(0, LIMITE_CARACTERES_CONTEUDO))
        )
    }));

    //vocabulario: token -> documentos em que aparece (titulo ou conteudo)
    const vocabulario = new Map();

    for (let indice = 0; indice < preparados.length; indice++) {
        const preparado = preparados[indice];
        const tokensDoDocumento = new Set([
            ...preparado.tituloTokens.keys(),
            ...preparado.conteudoTokens.keys()
        ]);

        for (const token of tokensDoDocumento) {
            if (!vocabulario.has(token)) {
                vocabulario.set(token, new Set());
            }

            vocabulario.get(token).add(indice);
        }
    }

    const idfMaximo = Math.log(1 + (totalDocumentos - 0.5) / 1.5);

    //para cada termo da consulta calcula o peso e os documentos alcancados
    const estatisticasTermos = termosConsulta.map((termo) => {
        const correspondencias = encontrarCorrespondencias(termo, vocabulario);
        const documentosComTermo = new Set();

        for (const { token } of correspondencias) {
            for (const indice of vocabulario.get(token)) {
                documentosComTermo.add(indice);
            }
        }

        const quantidadeDocumentos = documentosComTermo.size;
        const idf = calcularIdf(quantidadeDocumentos, totalDocumentos);
        const idfNormalizado = Math.min(1, idf / idfMaximo);

        //penalidade explicita para termos genericos: se o termo aparece em
        //muitos FAQs, (total - df + 1) / (total + 1) fica proximo de zero.
        //O +1 suaviza o calculo em acervos muito pequenos.
        const raridade = (totalDocumentos - quantidadeDocumentos + 1) / (totalDocumentos + 1);

        return {
            termo,
            correspondencias,
            documentosComTermo,
            peso: idfNormalizado * raridade
        };
    });

    const pesoTotalConsulta = estatisticasTermos.reduce(
        (total, estatistica) => total + estatistica.peso,
        0
    );

    if (pesoTotalConsulta <= 0) {
        return [];
    }

    const pontuacoes = preparados.map(() => ({
        titulo: 0,
        conteudo: 0,
        termosCasados: 0,
        somaPesosCasados: 0
    }));

    for (const estatistica of estatisticasTermos) {
        if (estatistica.correspondencias.length === 0) {
            continue;
        }

        //melhor casamento de cada documento para este termo da consulta
        const casamentosPorDocumento = new Map();

        for (const { token, pesoCasamento } of estatistica.correspondencias) {
            for (const indice of vocabulario.get(token)) {
                const preparado = preparados[indice];
                const tituloTf = preparado.tituloTokens.get(token) || 0;
                const conteudoTf = preparado.conteudoTokens.get(token) || 0;

                if (tituloTf === 0 && conteudoTf === 0) {
                    continue;
                }

                if (!casamentosPorDocumento.has(indice)) {
                    casamentosPorDocumento.set(indice, { titulo: 0, conteudo: 0 });
                }

                const casamento = casamentosPorDocumento.get(indice);

                if (tituloTf > 0) {
                    const pesoOcorrencia = pesoCasamento
                        * fatorOcorrencia(tituloTf, 0.12, 1.25);

                    if (pesoOcorrencia > casamento.titulo) {
                        casamento.titulo = pesoOcorrencia;
                    }
                }

                if (conteudoTf > 0) {
                    const pesoOcorrencia = pesoCasamento
                        * fatorOcorrencia(conteudoTf, 0.05, 1.1);

                    if (pesoOcorrencia > casamento.conteudo) {
                        casamento.conteudo = pesoOcorrencia;
                    }
                }
            }
        }

        for (const [indice, casamento] of casamentosPorDocumento) {
            const pontuacao = pontuacoes[indice];

            pontuacao.titulo += estatistica.peso * casamento.titulo;
            pontuacao.conteudo += estatistica.peso * casamento.conteudo;

            if (casamento.titulo > 0 || casamento.conteudo > 0) {
                pontuacao.termosCasados += 1;
                pontuacao.somaPesosCasados += estatistica.peso;
            }
        }
    }

    const resultados = [];

    for (let indice = 0; indice < preparados.length; indice++) {
        const pontuacao = pontuacoes[indice];

        if (pontuacao.termosCasados === 0) {
            continue;
        }

        //cobertura de cada campo: fracao (ponderada) dos termos encontrados
        const scoreTitulo = Math.min(1, pontuacao.titulo / pesoTotalConsulta);
        const scoreConteudo = Math.min(1, pontuacao.conteudo / pesoTotalConsulta);

        const scoreBase = PESOS_CAMPOS.titulo * scoreTitulo
            + PESOS_CAMPOS.conteudo * scoreConteudo;

        //media de importancia dos termos efetivamente encontrados. Uma busca
        //so com palavras genericas tem informatividade baixa, mesmo que o
        //documento contenha todas elas.
        const informatividade = pontuacao.somaPesosCasados / pontuacao.termosCasados;
        const score = scoreBase * informatividade;

        if (score < SCORE_MINIMO) {
            continue;
        }

        resultados.push({
            ...preparados[indice].documento,
            score: arredondarScore(score)
        });
    }

    //mais relevante primeiro; empate resolve pelo ranking de uso e depois pelo id
    resultados.sort((a, b) => {
        const diferencaScore = b.score - a.score;

        if (Math.abs(diferencaScore) > 1e-9) {
            return diferencaScore;
        }

        const diferencaCopias = obterNumero(b, campoCopias) - obterNumero(a, campoCopias);

        if (diferencaCopias !== 0) {
            return diferencaCopias;
        }

        return obterNumero(a, campoId) - obterNumero(b, campoId);
    });

    return resultados;
}
