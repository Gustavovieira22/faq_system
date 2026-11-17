import ExcelJS from 'exceljs';

//nomes das abas usadas no arquivo exportado
export const ABA_DADOS = 'Variaveis';
export const ABA_AJUDA = 'Instrucoes';

//limites de seguranca (protegem o servidor contra arquivos gigantes ou maliciosos)
export const LIMITE_ARQUIVO_BYTES = 5 * 1024 * 1024;
const LIMITE_LINHAS = 2000;
const LIMITE_COLUNAS = 200;
const LIMITE_CELULAS = 40000;
const LIMITE_TEXTO = 5000;
const LIMITE_AVISOS = 40;

const REGEX_IDENTIFICADOR = /^[A-Za-z0-9_]+$/;
const REGEX_NUMERO_CANONICO = /^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$/;
const NOME_COLUNA_LINHA = 'linha';
const NOME_RESERVADO = '__ORDEM_VARIAVEIS__';
const ACENTOS = /[\u0300-\u036f]/g;
const CARACTERES_INVALIDOS = /[^A-Za-z0-9_]+/g;

//erro esperado (arquivo invalido, estrutura desconhecida...) - vira resposta 400 com mensagem amigavel
export class ErroPlanilha extends Error {
    constructor(mensagem, status = 400) {
        super(mensagem);

        this.name = 'ErroPlanilha';
        this.status = status;
    }
}

//mesma normalizacao usada na tela: "preço cheio" -> "preco_cheio"
export function normalizarIdentificador(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(ACENTOS, '')
        .trim()
        .replace(CARACTERES_INVALIDOS, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
}

function formatarNumeroBrasileiro(numero) {
    return numero.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

//so exporta como numero o texto que volta identico ao ser formatado (1.234,56 / 912,60).
//qualquer outro texto ("2.110", "2019", "sob consulta") continua como texto para nao alterar o dado.
function numeroParaExportacao(texto) {
    const valor = String(texto ?? '').trim();

    if (!REGEX_NUMERO_CANONICO.test(valor)) {
        return null;
    }

    const numero = Number(valor.replace(/\./g, '').replace(',', '.'));

    if (!Number.isFinite(numero)) {
        return null;
    }

    return formatarNumeroBrasileiro(numero) === valor ? numero : null;
}

function estilizarCabecalho(linha) {
    linha.height = 22;

    linha.eachCell({ includeEmpty: true }, celula => {
        celula.font = { bold: true, color: { argb: 'FF17243D' }, size: 11 };
        celula.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFEFF3FA' }
        };
        celula.border = {
            bottom: { style: 'thin', color: { argb: 'FFC9D5E6' } }
        };
        celula.alignment = { vertical: 'middle', horizontal: 'left' };
    });
}

function adicionarAbaInstrucoes(workbook) {
    const aba = workbook.addWorksheet(ABA_AJUDA);

    const linhas = [
        ['Planilha de variáveis agrupadas'],
        [''],
        ['Como funciona'],
        ['Cada célula preenchida da tabela gera a variável linha.coluna automaticamente, por exemplo: curso_ads.preco_cheio.'],
        ['A primeira coluna ("linha") contém o nome de cada linha da tabela e não deve ser renomeada ou removida.'],
        ['As demais colunas da primeira linha são os nomes das colunas da tabela.'],
        [''],
        ['Como importar de volta'],
        ['1. Preencha a aba "Variaveis" com as correções desejadas (célula por célula ou em lote).'],
        ['2. Salve o arquivo como .xlsx (não use .xls, .csv, planilhas protegidas ou fórmulas sem resultado).'],
        ['3. Na tela de variáveis, clique em "Importar planilha" e escolha este arquivo.'],
        ['4. Confira a prévia das alterações e clique em "Aplicar na tabela".'],
        ['5. Clique em "Salvar variáveis" para gravar. Até esse momento nada é alterado no banco de dados.'],
        [''],
        ['Regras importantes'],
        ['Nomes de linhas e colunas aceitam apenas letras, números e sublinhado (_).'],
        ['Linhas ou colunas que existem na tela e não estão na planilha são mantidas (nada é apagado por omissão).'],
        ['Células vazias na planilha são ignoradas por padrão; a tela oferece a opção de limpar os valores vazios.'],
        ['Reordenar linhas ou colunas na planilha não muda a ordem da tabela na tela.'],
        ['Não use células mescladas nem mais de uma aba com dados de variáveis.'],
        [''],
        ['Formato dos valores'],
        ['Valores são textos livres (aceitam "sob consulta", "R$ 1.234,56", "12x", etc.).'],
        ['Células numéricas aparecem com o formato 1.234,56; qualquer outro conteúdo é mantido exatamente como foi digitado.'],
        ['']
    ];

    const titulos = ['Como funciona', 'Como importar de volta', 'Regras importantes', 'Formato dos valores'];

    linhas.forEach((conteudo, indice) => {
        const linha = aba.getRow(indice + 1);
        const celula = linha.getCell(1);

        celula.value = conteudo[0];
        celula.alignment = { wrapText: true, vertical: 'top' };

        if (indice === 0) {
            celula.font = { bold: true, size: 13, color: { argb: 'FF17243D' } };
        } else if (titulos.includes(conteudo[0])) {
            celula.font = { bold: true, color: { argb: 'FF2F4D80' } };
        }
    });

    aba.getColumn(1).width = 130;
}

//valida o payload enviado pela tela e devolve linhas/colunas normalizadas
function normalizarTabela({ linhas, colunas }) {
    if (!Array.isArray(colunas) || !Array.isArray(linhas)) {
        throw new ErroPlanilha('Envie as linhas e colunas da tabela para gerar a planilha.');
    }

    if (colunas.length > LIMITE_COLUNAS) {
        throw new ErroPlanilha(`A tabela tem ${colunas.length} colunas; o limite para exportar é ${LIMITE_COLUNAS}.`);
    }

    if (linhas.length > LIMITE_LINHAS) {
        throw new ErroPlanilha(`A tabela tem ${linhas.length} linhas; o limite para exportar é ${LIMITE_LINHAS}.`);
    }

    if ((linhas.length + 1) * (colunas.length + 1) > LIMITE_CELULAS) {
        throw new ErroPlanilha('A tabela é grande demais para exportar de uma vez. Reduza a quantidade de linhas ou colunas.');
    }

    const colunasNormalizadas = [];
    const nomesColunasVistos = new Set();

    colunas.forEach((coluna, indice) => {
        const original = String(coluna ?? '').trim();
        const nome = normalizarIdentificador(original);

        if (!nome) {
            throw new ErroPlanilha(`A coluna ${indice + 1} está sem nome. Corrija antes de exportar.`);
        }

        if (!REGEX_IDENTIFICADOR.test(nome)) {
            throw new ErroPlanilha(`O nome da coluna "${original}" é inválido. Use apenas letras, números e sublinhado.`);
        }

        if (nome === NOME_COLUNA_LINHA) {
            throw new ErroPlanilha('Nenhuma coluna pode se chamar "linha".');
        }

        if (nomesColunasVistos.has(nome)) {
            throw new ErroPlanilha(`Existem colunas com o mesmo nome depois da normalização: "${nome}". Renomeie uma delas.`);
        }

        nomesColunasVistos.add(nome);
        colunasNormalizadas.push({ original, nome });
    });

    const linhasNormalizadas = [];
    const nomesLinhasVistos = new Set();

    linhas.forEach((linha, indice) => {
        const original = String(linha?.nome ?? '').trim();
        const nome = normalizarIdentificador(original);

        if (!nome) {
            throw new ErroPlanilha(`A linha ${indice + 1} está sem nome. Corrija antes de exportar.`);
        }

        if (!REGEX_IDENTIFICADOR.test(nome)) {
            throw new ErroPlanilha(`O nome da linha "${original}" é inválido. Use apenas letras, números e sublinhado.`);
        }

        if (nomesLinhasVistos.has(nome)) {
            throw new ErroPlanilha(`Existem linhas com o mesmo nome depois da normalização: "${nome}". Renomeie uma delas.`);
        }

        nomesLinhasVistos.add(nome);

        const valoresOriginais = linha?.valores && typeof linha.valores === 'object' ? linha.valores : {};
        const valores = {};

        colunasNormalizadas.forEach(({ original: colunaOriginal, nome: colunaNome }) => {
            const valor = String(valoresOriginais[colunaOriginal] ?? valoresOriginais[colunaNome] ?? '').trim();

            if (valor.length > LIMITE_TEXTO) {
                throw new ErroPlanilha(`O valor de "${nome}.${colunaNome}" tem mais de ${LIMITE_TEXTO} caracteres e não pode ser exportado.`);
            }

            valores[colunaNome] = valor;
        });

        linhasNormalizadas.push({ nome, valores });
    });

    return {
        colunas: colunasNormalizadas,
        linhas: linhasNormalizadas
    };
}

//gera o arquivo .xlsx com a tabela agrupada
export function construirPlanilha(dadosTabela) {
    const { colunas, linhas } = normalizarTabela(dadosTabela || {});

    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'FAQ Respostas';
    workbook.created = new Date();

    const aba = workbook.addWorksheet(ABA_DADOS, {
        views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }]
    });

    aba.columns = [
        { header: NOME_COLUNA_LINHA, width: 30 },
        ...colunas.map(coluna => ({ header: coluna.nome, width: 26 }))
    ];

    estilizarCabecalho(aba.getRow(1));

    aba.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: colunas.length + 1 }
    };

    linhas.forEach(linhaTabela => {
        const valores = colunas.map(coluna => {
            const texto = linhaTabela.valores[coluna.nome] ?? '';
            const numero = numeroParaExportacao(texto);

            return numero === null ? texto : numero;
        });

        const linhaPlanilha = aba.addRow([linhaTabela.nome, ...valores]);
        const celulaNome = linhaPlanilha.getCell(1);

        celulaNome.font = { bold: true, color: { argb: 'FF17243D' } };
        celulaNome.numFmt = '@';

        valores.forEach((valor, indice) => {
            const celula = linhaPlanilha.getCell(indice + 2);

            if (typeof valor === 'number') {
                celula.numFmt = '#,##0.00';
                celula.alignment = { horizontal: 'right' };
                return;
            }

            celula.numFmt = '@';
            celula.alignment = { horizontal: 'left' };
        });
    });

    adicionarAbaInstrucoes(workbook);

    return workbook;
}

function formatarData(data) {
    const dia = String(data.getUTCDate()).padStart(2, '0');
    const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
    const ano = data.getUTCFullYear();
    const horas = data.getUTCHours();
    const minutos = data.getUTCMinutes();
    const dataFormatada = `${dia}/${mes}/${ano}`;

    if (horas === 0 && minutos === 0) {
        return dataFormatada;
    }

    return `${dataFormatada} ${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

//converte qualquer celula do Excel em { tipo: 'vazio' | 'texto' | 'numero', valor }
function lerCelula(celula, contexto, avisos) {
    const bruto = celula?.value;

    if (bruto === null || bruto === undefined) {
        return { tipo: 'vazio', valor: '' };
    }

    if (typeof bruto === 'number') {
        return Number.isFinite(bruto)
            ? { tipo: 'numero', valor: bruto }
            : { tipo: 'vazio', valor: '' };
    }

    if (typeof bruto === 'string') {
        const texto = bruto.trim();

        return texto ? { tipo: 'texto', valor: texto } : { tipo: 'vazio', valor: '' };
    }

    if (typeof bruto === 'boolean') {
        return { tipo: 'texto', valor: bruto ? 'sim' : 'nao' };
    }

    if (bruto instanceof Date) {
        const texto = formatarData(bruto);

        avisos.push(`${contexto}: data convertida para texto (${texto}).`);

        return { tipo: 'texto', valor: texto };
    }

    if (typeof bruto === 'object') {
        if (Array.isArray(bruto.richText)) {
            const texto = bruto.richText.map(parte => parte.text ?? '').join('').trim();

            return texto ? { tipo: 'texto', valor: texto } : { tipo: 'vazio', valor: '' };
        }

        if (bruto.formula !== undefined || bruto.sharedFormula !== undefined) {
            const resultado = lerCelula({ value: bruto.result }, contexto, avisos);

            if (resultado.tipo === 'vazio') {
                avisos.push(`${contexto}: fórmula sem valor calculado foi ignorada. Use um valor fixo.`);
            }

            return resultado;
        }

        if (bruto.error !== undefined) {
            avisos.push(`${contexto}: célula com erro (${bruto.error}) foi ignorada.`);

            return { tipo: 'vazio', valor: '' };
        }

        if (typeof bruto.text === 'string') {
            const texto = bruto.text.trim();

            return texto ? { tipo: 'texto', valor: texto } : { tipo: 'vazio', valor: '' };
        }
    }

    avisos.push(`${contexto}: conteúdo não reconhecido foi ignorado.`);

    return { tipo: 'vazio', valor: '' };
}

function limitarAvisos(avisos) {
    if (avisos.length <= LIMITE_AVISOS) {
        return avisos;
    }

    const restantes = avisos.length - LIMITE_AVISOS;

    return [
        ...avisos.slice(0, LIMITE_AVISOS),
        `... e mais ${restantes} ${restantes === 1 ? 'aviso' : 'avisos'}.`
    ];
}

//le e valida o arquivo enviado; nunca grava nada no banco, apenas devolve a estrutura para a tela conferir
export async function lerPlanilha(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new ErroPlanilha('Nenhum arquivo foi recebido. Selecione uma planilha .xlsx.');
    }

    if (buffer.length > LIMITE_ARQUIVO_BYTES) {
        throw new ErroPlanilha('O arquivo é maior que 5 MB. Envie uma planilha menor.', 413);
    }

    const workbook = new ExcelJS.Workbook();

    try {
        await workbook.xlsx.load(buffer);
    } catch (error) {
        throw new ErroPlanilha('Não foi possível abrir o arquivo. Envie uma planilha .xlsx válida e sem proteção por senha.');
    }

    const abas = workbook.worksheets || [];

    if (abas.length === 0) {
        throw new ErroPlanilha('A planilha não tem nenhuma aba com dados.');
    }

    const aba = workbook.getWorksheet(ABA_DADOS) || abas[0];
    const totalLinhas = aba.actualRowCount || 0;
    const totalColunas = aba.actualColumnCount || 0;

    if (totalLinhas === 0 || totalColunas === 0) {
        throw new ErroPlanilha('A planilha está vazia. Exporte a tabela pela tela e edite esse arquivo.');
    }

    if (totalColunas < 2) {
        throw new ErroPlanilha('A planilha precisa da coluna "linha" e de pelo menos uma coluna de valores.');
    }

    if (totalColunas - 1 > LIMITE_COLUNAS) {
        throw new ErroPlanilha(`A planilha tem ${totalColunas - 1} colunas de valores; o limite é ${LIMITE_COLUNAS}.`);
    }

    if (totalLinhas - 1 > LIMITE_LINHAS) {
        throw new ErroPlanilha(`A planilha tem ${totalLinhas - 1} linhas de dados; o limite é ${LIMITE_LINHAS}.`);
    }

    if (totalLinhas * totalColunas > LIMITE_CELULAS) {
        throw new ErroPlanilha('A planilha é grande demais para importar de uma vez. Reduza a quantidade de linhas ou colunas.');
    }

    const avisos = [];
    const cabecalho = aba.getRow(1);
    const primeiraColuna = lerCelula(cabecalho.getCell(1), 'Coluna A (cabeçalho)', avisos);

    if (normalizarIdentificador(primeiraColuna.valor).toLowerCase() !== NOME_COLUNA_LINHA) {
        throw new ErroPlanilha('A célula A1 da planilha deve conter o título "linha". Não renomeie a primeira coluna.');
    }

    const colunas = [];
    const colunasVistas = new Set();

    for (let indice = 2; indice <= totalColunas; indice += 1) {
        const letra = aba.getColumn(indice).letter;
        const celulaCabecalho = lerCelula(cabecalho.getCell(indice), `Coluna ${letra} (cabeçalho)`, avisos);

        if (celulaCabecalho.tipo === 'numero') {
            throw new ErroPlanilha(`A coluna ${letra} tem um número como nome. Use letras, números e sublinhado (ex.: preco_cheio).`);
        }

        const original = String(celulaCabecalho.valor ?? '').trim();

        if (!original) {
            throw new ErroPlanilha(`A coluna ${letra} está sem nome na primeira linha. Preencha o nome ou remova a coluna.`);
        }

        const nome = normalizarIdentificador(original);

        if (nome !== original) {
            avisos.push(`Coluna ${letra}: nome "${original}" ajustado para "${nome}".`);
        }

        if (!nome || !REGEX_IDENTIFICADOR.test(nome)) {
            throw new ErroPlanilha(`O nome da coluna ${letra} ("${original}") é inválido. Use apenas letras, números e sublinhado.`);
        }

        if (nome === NOME_COLUNA_LINHA) {
            throw new ErroPlanilha(`A coluna ${letra} não pode se chamar "linha".`);
        }

        if (colunasVistas.has(nome)) {
            throw new ErroPlanilha(`Existem colunas repetidas na planilha: "${nome}". Cada coluna deve ter um nome único.`);
        }

        colunasVistas.add(nome);
        colunas.push(nome);
    }

    const linhas = [];
    const linhasVistas = new Set();
    let linhasVazias = 0;

    for (let numeroLinha = 2; numeroLinha <= totalLinhas; numeroLinha += 1) {
        const linhaPlanilha = aba.getRow(numeroLinha);
        const celulaNome = lerCelula(linhaPlanilha.getCell(1), `Linha ${numeroLinha} (coluna A)`, avisos);
        const valores = {};
        let celulasPreenchidas = 0;

        for (let indice = 2; indice <= totalColunas; indice += 1) {
            const coluna = colunas[indice - 2];
            const celula = lerCelula(linhaPlanilha.getCell(indice), `Linha ${numeroLinha}, coluna "${coluna}"`, avisos);

            if (celula.tipo === 'vazio') {
                continue;
            }

            if (celula.tipo === 'texto' && String(celula.valor).length > LIMITE_TEXTO) {
                throw new ErroPlanilha(`A célula da linha ${numeroLinha}, coluna "${coluna}" passa de ${LIMITE_TEXTO} caracteres.`);
            }

            valores[coluna] = celula;
            celulasPreenchidas += 1;
        }

        //linha sem nome e sem valores: apenas ignorada
        if (celulaNome.tipo === 'vazio' && celulasPreenchidas === 0) {
            linhasVazias += 1;
            continue;
        }

        if (celulaNome.tipo === 'numero') {
            throw new ErroPlanilha(`A linha ${numeroLinha} tem um número como nome. O nome deve ser um identificador (ex.: curso_ads).`);
        }

        const original = String(celulaNome.valor ?? '').trim();

        if (!original) {
            throw new ErroPlanilha(`A linha ${numeroLinha} está sem nome na coluna A. Preencha o nome ou apague a linha inteira.`);
        }

        const nome = normalizarIdentificador(original);

        if (nome !== original) {
            avisos.push(`Linha ${numeroLinha}: nome "${original}" ajustado para "${nome}".`);
        }

        if (original.toUpperCase() === NOME_RESERVADO) {
            throw new ErroPlanilha(`O nome da linha ${numeroLinha} ("${original}") é reservado pelo sistema.`);
        }

        if (!nome || !REGEX_IDENTIFICADOR.test(nome)) {
            throw new ErroPlanilha(`O nome da linha ${numeroLinha} ("${original}") é inválido. Use apenas letras, números e sublinhado.`);
        }

        if (nome === NOME_COLUNA_LINHA) {
            throw new ErroPlanilha(`A linha ${numeroLinha} não pode se chamar "linha".`);
        }

        if (linhasVistas.has(nome)) {
            throw new ErroPlanilha(`Existem linhas repetidas na planilha: "${nome}". Cada linha deve ter um nome único.`);
        }

        linhasVistas.add(nome);

        if (celulasPreenchidas === 0) {
            avisos.push(`Linha ${numeroLinha} (${nome}) está sem valores preenchidos.`);
        }

        linhas.push({ nome, valores });
    }

    if (linhasVazias > 0) {
        avisos.push(`${linhasVazias} ${linhasVazias === 1 ? 'linha vazia foi ignorada' : 'linhas vazias foram ignoradas'}.`);
    }

    if (linhas.length === 0) {
        throw new ErroPlanilha('A planilha não tem nenhuma linha de dados preenchida.');
    }

    return {
        aba: aba.name,
        colunas,
        linhas,
        avisos: limitarAvisos(avisos),
        totais: {
            linhas: linhas.length,
            colunas: colunas.length,
            celulasPreenchidas: linhas.reduce((total, linha) => total + Object.keys(linha.valores).length, 0)
        }
    };
}

export function nomeArquivoExportacao(data = new Date()) {
    const dataTexto = [
        data.getFullYear(),
        String(data.getMonth() + 1).padStart(2, '0'),
        String(data.getDate()).padStart(2, '0')
    ].join('-');

    const horaTexto = [
        String(data.getHours()).padStart(2, '0'),
        String(data.getMinutes()).padStart(2, '0')
    ].join('');

    return `variaveis-agrupadas-${dataTexto}-${horaTexto}.xlsx`;
}
