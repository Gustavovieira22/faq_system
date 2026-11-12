export function substituirVariaveis(texto, variaveis) {
    if (!texto) {
        return texto;
    }

    return texto.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (match, nome) => {
        const variavel = variaveis.find(
            variavel => variavel.nome === nome
        );

        return variavel ? variavel.valor : match;
    });
}