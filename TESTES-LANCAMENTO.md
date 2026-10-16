# PROTEGE — Plano de testes antes do lançamento

Estado: checklist manual pendente. Marcar cada teste apenas depois de o executar na versão publicada.

Aplicação: https://protege-app.vercel.app/

## Preparação

- Usar duas contas de cliente diferentes (Cliente A e Cliente B).
- Usar uma conta administrativa autorizada.
- Não usar equipamentos reais de terceiros nem documentos pessoais desnecessários nos testes.
- Guardar apenas resultados, mensagens de erro e identificadores técnicos; não partilhar palavras-passe, tokens ou dados pessoais.

## A. Conta e autenticação

- [ ] Criar uma conta de teste e terminar sessão.
- [ ] Entrar novamente com a conta.
- [ ] Testar recuperação de palavra-passe.
- [ ] Confirmar que uma conta normal não consegue abrir ou utilizar a área administrativa.
- [ ] Confirmar que sair da conta termina o acesso ao painel.

## B. Registo e privacidade de equipamentos

- [ ] Registar equipamento com 2 fotografias e verificar que aparece na lista do Cliente A.
- [ ] Confirmar que não é possível registar sem as fotografias obrigatórias.
- [ ] Anexar um comprovativo PDF ou imagem e confirmar que abre apenas para o proprietário e administradores autorizados.
- [ ] Editar o equipamento e verificar se os dados ficam guardados.
- [ ] Marcar um equipamento de teste como perdido/roubado e confirmar o estado apresentado.
- [ ] Entrar como Cliente B e tentar encontrar o equipamento do Cliente A na área privada: o acesso deve ser negado.

## C. Consulta pública por SN/IMEI

- [ ] Consultar um SN de teste existente e confirmar que aparece apenas o nome do equipamento e o estado/restrição.
- [ ] Confirmar que não aparecem nome do proprietário, email, telefone, fotografias ou comprovativos.
- [ ] Consultar um SN inexistente e confirmar uma resposta clara sem dados privados.
- [ ] Testar entrada inválida e espaços antes/depois do SN.
- [ ] Confirmar que a página não revela dados privados na mensagem de erro.

## D. Chat e anexos

- [ ] Cliente A envia mensagem de texto; o administrador recebe.
- [ ] Cliente A envia uma fotografia; o administrador abre.
- [ ] Administrador responde com PDF; Cliente A abre.
- [ ] Enviar vídeo e confirmar reprodução.
- [ ] Enviar texto e anexo na mesma mensagem.
- [ ] Tentar um ficheiro não permitido e um ficheiro superior a 25 MB; o envio deve ser bloqueado com explicação.
- [ ] Cliente B não deve conseguir ler as conversas ou abrir anexos do Cliente A.
- [ ] Atualizar a página e confirmar que as mensagens continuam disponíveis.
- [ ] Confirmar que não surgem mensagens duplicadas depois de enviar.

## E. Painel administrativo

- [ ] Consultar equipamentos e respetivos comprovativos.
- [ ] Abrir a caixa de mensagens de apoio.
- [ ] Abrir uma conversa de chat, responder e confirmar a atualização de estado.
- [ ] Confirmar que uma conta sem função administrativa não consegue chamar as operações administrativas.
- [ ] Confirmar que erros de rede são apresentados sem expor tokens ou detalhes internos.

## F. Navegadores e dispositivos

- [ ] Computador: Chrome ou Edge.
- [ ] Telemóvel: Android/Chrome.
- [ ] Telemóvel: iPhone/Safari, se disponível.
- [ ] Testar formulários, menus, anexos, vídeos e botões sem deslocamento horizontal indesejado.

## Registo de falhas

Para cada falha, registar:
1. Secção e passo.
2. Resultado esperado.
3. Resultado observado.
4. Navegador/dispositivo.
5. Mensagem de erro sem dados pessoais.

## Critério para avançar

Só considerar os testes funcionais concluídos depois de testar com duas contas de cliente separadas e uma conta administrativa. Não usar a plataforma publicamente como serviço plenamente validado antes de resolver falhas críticas e publicar a documentação de privacidade.
