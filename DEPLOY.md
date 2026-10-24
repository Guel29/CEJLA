# Prévia interativa no Render

## Alternativa sem Render: GitHub Codespaces

Abra https://codespaces.new/Guel29/CEJLA?ref=main e crie o Codespace. Esse link cria o ambiente de desenvolvimento; não é uma URL de aplicativo já hospedado. É necessário entrar no GitHub e ter acesso ao Codespaces e saldo de uso disponível. A configuração `.devcontainer/devcontainer.json` prepara Node.js 24, executa os testes e inicia o CEJLA automaticamente.

Quando o ambiente abrir, selecione **Ports / Portas**, encontre **3000 — Abrir CEJLA** e clique no ícone de globo para abrir o aplicativo. O GitHub atribui a URL HTTPS nesse momento. A porta permanece privada e requer sua autenticação no GitHub. Não altere para pública com dados reais ou com a senha demonstrativa do administrador.

Alterações de telas feitas nesse Codespace são detectadas pelo aplicativo; alterações feitas em outro ambiente precisam ser publicadas no GitHub e atualizadas no Codespace. Não existe sincronização automática entre os dois ambientes. O serviço para quando o Codespace é encerrado; não é hospedagem permanente.

Se o início automático falhar, execute `npm run dev` no terminal do Codespace e abra a porta 3000. O consumo e a disponibilidade do Codespaces dependem da sua conta GitHub; confira a franquia e os limites antes de criar recursos pagos.

## Configuração do Render

O aplicativo está preparado para uma hospedagem de demonstração no Render, com HTTPS e implantação automática a partir do GitHub. Nenhuma URL pública foi criada nesta tarefa: não há conta de hospedagem conectada nem ferramenta de publicação no ambiente atual.

## O que conectar

1. Use os arquivos deste projeto na branch `main` do repositório `Guel29/CEJLA`. Não envie `data/`, senhas pessoais ou credenciais. A pasta `data/` já está ignorada pelo Git.
2. Entre em https://dashboard.render.com e conecte sua conta GitHub, autorizando o repositório `Guel29/CEJLA`.
3. Escolha **New → Blueprint**, selecione o repositório e a branch `main`. O arquivo `render.yaml` define o serviço de demonstração. Confira que o plano selecionado é **Free** antes de criar.
4. Aguarde a construção e os testes. Abra o endereço HTTPS informado pelo Render na página do serviço. Use esse endereço para todos os perfis. A URL real é atribuída pelo provedor; não foi inventada neste documento.

Não envie tokens ou senhas de hospedagem no chat. A conexão é feita diretamente na interface do provedor.

## Atualizações durante o desenvolvimento

Após a implantação inicial, cada novo commit publicado na branch conectada dispara uma nova implantação. Alterações feitas somente neste ambiente não chegam ao Render até serem publicadas no GitHub. O tempo inclui a construção e o reinício do provedor, portanto não é espelhamento instantâneo do editor.

O aplicativo verifica sua versão a cada 15 segundos quando a aba está visível. Quando uma nova versão estiver disponível, atualiza a página se nenhum formulário tiver sido alterado; caso contrário, mostra um aviso para você atualizar sem perder o preenchimento inadvertidamente.

## Acessos de demonstração

Senha inicial para todos: `Escola@123`.

| Perfil | Telefone | Código |
| --- | --- | --- |
| Aluno | 11900000001 | 000001 |
| Professor | 11900000002 | 000002 |
| Diretor | 11900000003 | 000003 |
| Administrador | 11900000004 | 000004 |

O código é necessário apenas quando o telefone é compartilhado entre contas. Utilize exclusivamente dados fictícios: essas credenciais são públicas para demonstração.

## Limites do plano de demonstração

O SQLite fica em disco temporário. Reinícios e novas implantações podem apagar alterações e restaurar os dados iniciais. O serviço gratuito pode entrar em repouso e demorar na primeira abertura. Não use essa configuração para registros reais da escola.

Para persistência, configure um plano com disco persistente no Render, monte o disco em `/var/data` e altere `DATA_DIR` para `/var/data/cejla`. Isso pode exigir cobrança pelo provedor; a configuração preparada aqui não solicita esse plano pago. Defina também backups e credenciais próprias antes de uso real.

## Funcionalidades

Disponíveis: login, contas por perfil, cadastros administrativos, vínculos de professores e alunos, avaliações e notas, médias, boletim CSV, conquistas, recados com emojis, períodos e controle manual de licenças.

Pendentes: pagamentos reais e recuperação de senha por SMS (adiados pelo usuário). Consulte o README para limitações de gestão e requisitos antes de produção.
