//variavel reservada que guarda a estrutura da tabela na ordem exibida na tela
const NOME_VARIAVEL_ORDEM = '__ORDEM_VARIAVEIS__';

//aceita o mesmo formato do cadastro: nome simples ou "linha.coluna"
const PADRAO_NOME = /^[A-Za-z0-9_]+$/;

//mesmo padrao reconhecido por substituirVariavel.js
const PADRAO_MARCADOR = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;

function normalizarLista(lista) {
    if (!Array.isArray(lista)) {
        return [];
    }

    const porOrigem = new Map();

    lista.forEach(item => {
        const de = String(item?.de ?? '').trim();
        const para = String(item?.para ?? '').trim();

        if (!PADRAO_NOME.test(de) || !PADRAO_NOME.test(para)) {
            return;
        }

        if (de === para || de === NOME_VARIAVEL_ORDEM || para === NOME_VARIAVEL_ORDEM) {
            return;
        }

        porOrigem.set(de, para);
    });

    return Array.from(porOrigem, ([de, para]) => ({ de, para }));
}

export function normalizarRenomeacoes(entrada) {
    const dados = entrada && typeof entrada === 'object' ? entrada : {};

    return {
        linhas: normalizarLista(dados.linhas),
        colunas: normalizarLista(dados.colunas),
        simples: normalizarLista(dados.simples)
    };
}

//estrutura da tabela salva: prioriza a variavel reservada e, se ela faltar, deduz pelos nomes
function lerEstrutura(registros) {
    const estrutura = {
        linhas: new Set(),
        colunas: new Set(),
        simples: new Set()
    };

    const ordem = registros.find(registro => registro.nome === NOME_VARIAVEL_ORDEM);

    if (ordem) {
        try {
            const dados = JSON.parse(ordem.valor);

            ['linhas', 'colunas', 'simples'].forEach(chave => {
                if (Array.isArray(dados?.[chave])) {
                    dados[chave].forEach(nome => estrutura[chave].add(String(nome)));
                }
            });

            return estrutura;

        } catch (error) {
            console.error('Estrutura da tabela de variaveis invalida:', error);
        }
    }

    registros.forEach(registro => {
        const partes = String(registro.nome).split('.');

        if (partes.length === 2) {
            estrutura.linhas.add(partes[0]);
            estrutura.colunas.add(partes[1]);
        } else if (partes.length === 1 && registro.nome !== NOME_VARIAVEL_ORDEM) {
            estrutura.simples.add(partes[0]);
        }
    });

    return estrutura;
}

//mantem apenas renomeacoes coerentes com o que acabou de ser salvo:
//o nome antigo nao pode continuar na tabela e o novo precisa existir
export function resolverRenomeacoes(entrada, registros) {
    const renomeacoes = normalizarRenomeacoes(entrada);
    const estrutura = lerEstrutura(registros);

    return {
        linhas: renomeacoes.linhas.filter(item => (
            estrutura.linhas.has(item.para) && !estrutura.linhas.has(item.de)
        )),
        colunas: renomeacoes.colunas.filter(item => (
            estrutura.colunas.has(item.para) && !estrutura.colunas.has(item.de)
        )),
        simples: renomeacoes.simples.filter(item => (
            estrutura.simples.has(item.para) && !estrutura.simples.has(item.de)
        ))
    };
}

export function temRenomeacoes(renomeacoes) {
    return renomeacoes.linhas.length + renomeacoes.colunas.length + renomeacoes.simples.length > 0;
}

export function descreverRenomeacoes(renomeacoes) {
    return [
        ...renomeacoes.linhas,
        ...renomeacoes.colunas,
        ...renomeacoes.simples
    ].map(item => `${item.de} → ${item.para}`).join(', ');
}

//troca os marcadores {{...}} pelos nomes novos, preservando o restante do texto
export function renomearVariaveisNoTexto(texto, renomeacoes) {
    if (typeof texto !== 'string' || !texto) {
        return texto;
    }

    return texto.replace(PADRAO_MARCADOR, (marcador, nome) => {
        const partes = nome.split('.');

        if (partes.length === 1) {
            const simples = renomeacoes.simples.find(item => item.de === nome);

            return simples ? `{{${simples.para}}}` : marcador;
        }

        if (partes.length !== 2) {
            return marcador;
        }

        const [prefixo, sufixo] = partes;
        const linha = renomeacoes.linhas.find(item => item.de === prefixo);
        const coluna = renomeacoes.colunas.find(item => item.de === sufixo);
        const novaLinha = linha ? linha.para : prefixo;
        const novaColuna = coluna ? coluna.para : sufixo;

        if (novaLinha === prefixo && novaColuna === sufixo) {
            return marcador;
        }

        return `{{${novaLinha}.${novaColuna}}}`;
    });
}
