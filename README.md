# CEJLA

Portal escolar em português, com dados persistentes em SQLite, contas individuais e interface para computador e celular. Esta é uma versão de desenvolvimento com dados fictícios; pagamentos e recuperação por SMS foram adiados por decisão do usuário.

## Executar

Requer Node.js 24 ou superior. A aplicação não depende de pacotes externos.

```sh
npm start
# Desenvolvimento, com reinício automático do servidor:
npm run dev
# Testes:
npm test
```

Porta padrão: 3000, alterável com `PORT`. O banco fica em `data/cejla.sqlite`; `DATA_DIR` seleciona outro diretório. Não apague esse diretório: ele contém as contas, notas, sessões, recados e auditoria. A inicialização atualiza o esquema sem reinicializar os dados.

## Contas de demonstração

Senha inicial: `Escola@123`.

| Perfil | Telefone | Código |
| --- | --- | --- |
| Aluno | 11900000001 | 000001 |
| Professor | 11900000002 | 000002 |
| Diretor | 11900000003 | 000003 |
| Administrador | 11900000004 | 000004 |
| Aluno de outra escola | 11900000005 | 000005 |

O código é opcional para telefones individuais e obrigatório quando mais de uma conta ativa compartilha o telefone. O administrador consulta os códigos na lista de usuários. Não existe seleção pública de alunos pelo telefone. Dados demonstrativos são inseridos apenas na primeira inicialização de uma base vazia.

## Fluxo de uso

1. Entre como administrador e abra Administração.
2. Cadastre escola, turmas, disciplinas e usuários. Vincule diretores à escola por seu cadastro.
3. Matricule os alunos e vincule professores à combinação de escola, turma e disciplina.
4. Configure períodos, pesos de disciplinas e limites de medalhas quando necessário.
5. Entre como professor, crie avaliações e lance notas. Correções de notas exigem justificativa.
6. Consulte o boletim como aluno ou diretor. O diretor é somente leitura; o aluno consulta apenas os próprios registros.
7. Publique recados por turma ou para um aluno específico. Professores e administrador podem reagir com 👍 ❤️ 👏 😊. Cada pessoa tem uma reação por recado; clicar novamente remove, escolher outra substitui. Alunos e diretores visualizam as contagens.

## Recursos implementados

- Login com senha protegida por scrypt, cookie HttpOnly/SameSite, sessões com expiração e limitação local de tentativas.
- Isolamento por escola, perfil e vínculos no servidor; acesso de diretor somente para leitura.
- Cadastro de escolas, turmas, disciplinas, usuários, matrículas e vínculos de professores.
- Edição dos dados pessoais e desativação de usuários pelo administrador, renomeação de escolas/turmas/disciplinas preservando os vínculos, remoção de vínculos sem apagar notas.
- Nome, nascimento, pai, mãe e telefone; observações pessoais internas visíveis apenas ao administrador.
- Alteração de senha autenticada e redefinição pelo administrador; revogação de sessões após redefinição.
- Avaliações com tipo, data, período, pontuação máxima e peso; edição de título, peso, tipo e data.
- Notas, ausência e dispensa. Nota não lançada permanece pendente, não se transforma em zero.
- Boletim por aluno, filtros de disciplina e período, download CSV com proteção contra fórmulas em células exportadas.
- Configuração dos limites de medalhas por escola; troféu por avaliação com 100% e por disciplina/período somente com todas as avaliações concluídas e aproveitamento real de 100%, sem arredondamento.
- Encerramento de períodos bloqueia criação de avaliações e alterações acadêmicas naquele período; administrador pode reabrir.
- Histórico de correções de notas e eventos administrativos.
- Licenças manuais para professor/diretor com estados ativa, pendente, vencida e cancelada, e vencimento opcional. Suspensão bloqueia os recursos do titular, preservando notas e acesso dos alunos. Contas sem licença explícita permanecem ativas em modo de demonstração. Não há cobrança real.

## Cálculo dos resultados

Na avaliação: `nota / pontuação máxima × 100`.

Na disciplina/período: média dos percentuais ponderada pelos pesos das avaliações. Ausência entra como zero, dispensa fica fora do cálculo e pendência não entra como zero. Pendências tornam o resultado parcial. Sem notas computáveis, o resultado é “Sem resultado”.

Resultado geral: média dos resultados de disciplina/período, ponderada pelo peso cadastrado para a disciplina (padrão 1). O relatório identifica o recorte acessível ao usuário. Os filtros da tabela não recalculam o resultado geral exibido. Os períodos permanecem separados no detalhamento.

Limites padrão: bronze 60%, prata 75%, ouro 90%, troféu exatamente 100%. Os limites podem ser modificados pelo administrador. Não há ranking público.

## Prévia visual

Capturas reais de navegador ficam em `artifacts/`: login, painel do aluno, celular, administração, recados do professor e boletim. São imagens, não um site publicado. Este ambiente não disponibilizou ferramenta de URL pública; não há link externo de aplicação publicado.

## Verificação

`npm test` cobre autenticação, escolas e perfis, restrições de turma/disciplina, validação e correção de notas, persistência após reinício, reações, dados pessoais privados, recados, troca e redefinição de senha, telefone compartilhado, licenças, períodos encerrados, configurações e cálculos de médias/conquistas. A navegação e os formulários também foram exercitados com Chromium, incluindo layout móvel e download do CSV.

## Pendências e limites

- Integração real com provedor de pagamentos e envio de recuperação por SMS: pendentes por escolha do usuário. Nenhuma cobrança é simulada como real.
- Cadastro mantém histórico: exclusão física de contas, escolas e registros acadêmicos não é oferecida. Usuários podem ser desativados e vínculos removidos. Procedimentos legais de retenção/eliminação precisam ser definidos antes de dados reais.
- Alteração de telefone, perfil e escola de uma conta existente e transferências com histórico entre escolas ainda precisam de um fluxo específico; não são realizadas pela edição de dados pessoais.
- A limitação de login é em memória por processo/IP; implantação com proxy e múltiplas instâncias exige configuração própria e armazenamento compartilhado.
- Backup, monitoramento, HTTPS, remoção de contas demonstrativas, políticas de privacidade/consentimento e revisão de segurança/LGPD são necessários antes de uso com alunos reais.

Em HTTPS, configure `COOKIE_SECURE=1`. Não use as credenciais de demonstração em produção. Não exponha o arquivo SQLite nem o diretório de dados por servidor estático. Este projeto serve somente os arquivos públicos permitidos explicitamente.

## Hospedagem de demonstração

O arquivo `render.yaml` prepara uma prévia gratuita no Render com implantação automática pelo GitHub. Veja [DEPLOY.md](DEPLOY.md) para conectar as contas e obter a URL HTTPS. A configuração gratuita usa dados temporários; não é destinada a registros reais. O navegador verifica novas versões a cada 15 segundos, preservando formulários em preenchimento. Nenhuma URL pública foi criada neste ambiente.
