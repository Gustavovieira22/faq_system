const { createApp } = Vue;

createApp({
    data() {
        return {
            editorResposta: null,
            editorEdicaoResposta: null,
            perguntas: [],
            busca: '',
            carregando: true,
            salvandoEdicao: false,
            form: {
                titulo: '',
                resposta: '',
            },
            editForm: {
                id: null,
                titulo: '',
                resposta: '',
            }
        };
    },

    computed: {
        perguntasFiltradas() {
            const termo = this.busca
                .trim()
                .toLowerCase();

            //limita a quantidade de perguntas exibidas na tela
            if (!termo) {
                return this.perguntas.slice(0, 20);
            }

            //limita a quantidade de perguntas retornadas na busca
            return this.perguntas
                .filter(pergunta =>
                    pergunta.titulo
                        .toLowerCase()
                        .includes(termo)
                )
                .slice(0, 20);
        }
    },

    methods: {
        async cadastrarPergunta() {
            try {
                this.form.resposta = this.editorResposta.root.innerHTML;
                const response = await fetch('/api/perguntas', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.form)
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.erro || 'Erro ao cadastrar pergunta.');
                }
                
                console.log(data);

                this.editorResposta.root.innerHTML = '';
                this.form = {
                    titulo: '',
                    resposta: '',
                };

                const modalElement = document.getElementById('modalCadastroPergunta');
                const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                modal.hide();

                this.carregando = true;
                this.getPerguntas();

            } catch (error) {
                console.error(error);
            }
        },
        abrirModalEdicao(pergunta) {
            this.editForm = {
                id: pergunta.id,
                titulo: pergunta.titulo,
                resposta: pergunta.respostaOriginal || pergunta.resposta,
            };

            this.editorEdicaoResposta.root.innerHTML = this.editForm.resposta;

            const modalElement = document.getElementById('modalEditarPergunta');
            const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
            modal.show();
        },
        async salvarEdicaoPergunta() {
            this.salvandoEdicao = true;

            try {
                this.editForm.resposta = this.editorEdicaoResposta.root.innerHTML;

                const response = await fetch(`/api/perguntas/${this.editForm.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        titulo: this.editForm.titulo,
                        resposta: this.editForm.resposta
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.erro || 'Erro ao atualizar pergunta.');
                }

                const modalElement = document.getElementById('modalEditarPergunta');
                const modal = bootstrap.Modal.getInstance(modalElement) || new bootstrap.Modal(modalElement);
                modal.hide();

                this.editForm = {
                    id: null,
                    titulo: '',
                    resposta: '',
                };

                this.carregando = true;
                await this.getPerguntas();

            } catch (error) {
                console.error(error);
                alert(error.message);

            } finally {
                this.salvandoEdicao = false;
            }
        },
        async getPerguntas(){
            try {
                const response = await fetch('/api/perguntas');
                this.perguntas = await response.json();

            } catch (error) {
                console.error('Erro ao carregar perguntas:', error);

            }finally {
                this.carregando = false;
            }
        },
        htmlParaTextoWhatsapp(html) {
            const container = document.createElement('div');
            container.innerHTML = html;

            const converterNode = (node) => {
                if (node.nodeType === Node.TEXT_NODE) {
                    return node.textContent;
                }

                if (node.nodeType !== Node.ELEMENT_NODE) {
                    return '';
                }

                const tag = node.tagName.toLowerCase();

                if (tag === 'br') {
                    return '\n';
                }

                let conteudo = '';

                for (const child of node.childNodes) {
                    conteudo += converterNode(child);
                }

                if (tag === 'strong' || tag === 'b') {
                    conteudo = `*${conteudo}*`;
                }

                if (tag === 'em' || tag === 'i') {
                    conteudo = `_${conteudo}_`;
                }

                if (tag === 'p' || tag === 'div') {
                    return conteudo + '\n';
                }

                return conteudo;
            };

            let texto = '';

            for (const child of container.childNodes) {
                texto += converterNode(child);
            }

            return texto.trim();
        },

        async copiarResposta(respostaHtml) {
            try {
                const texto = this.htmlParaTextoWhatsapp(respostaHtml);

                await navigator.clipboard.writeText(texto);

            } catch (error) {
                console.error('Erro ao copiar resposta:', error);
                alert('Não foi possível copiar a resposta.');
            }
        }
    },

    async mounted() {
        this.getPerguntas();

        this.editorResposta = new Quill('#editor-resposta', {
            theme: 'snow',
            placeholder: 'Digite um texto para resposta',
            modules: {
                toolbar: [
                    ['bold', 'italic'],
                    ['clean']
                ]
            }
        });

        this.editorEdicaoResposta = new Quill('#editor-edicao-resposta', {
            theme: 'snow',
            placeholder: 'Digite um texto para resposta',
            modules: {
                toolbar: [
                    ['bold', 'italic'],
                    ['clean']
                ]
            }
        });
    }
}).mount('#app');
