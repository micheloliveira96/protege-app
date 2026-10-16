# PROTEGE

Plataforma de registo e consulta de equipamentos, orientada para privacidade, em Portugal.

## Estado do projeto

Aplicação em desenvolvimento e testes. Não apresentar como serviço oficial, certificação de propriedade ou garantia de recuperação de bens.

## Funcionalidades implementadas

- Registo e autenticação de utilizadores com Supabase Auth.
- Perfil do utilizador e gestão dos próprios equipamentos.
- Registo de equipamento com 2 a 4 fotografias privadas e comprovativo de compra opcional.
- Consulta pública por número de série (SN) ou IMEI, mostrando apenas o nome do equipamento e o estado/restrição registados.
- Painel administrativo protegido por verificação de sessão e registo de administradores.
- Histórico de consultas.
- Formulário de apoio e chat privado entre utilizador e equipa administrativa.
- Anexos privados no chat: imagens, vídeos e PDF, até 25 MB.

## Tecnologias

- React
- Vite
- Supabase Auth, PostgreSQL, Storage e Edge Functions
- Vercel

## Repositório e publicação

- Repositório: https://github.com/micheloliveira96/protege-app
- Aplicação: https://protege-app.vercel.app/

## Variáveis de ambiente do frontend

Configurar na Vercel, sem guardar valores secretos neste repositório:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Nunca colocar `SUPABASE_SERVICE_ROLE_KEY), palavras-passe, tokens ou outras credenciais privadas no código frontend ou no GitHub. A chave publishable é usada no browser e depende das políticas RLS para proteger os dados.

## Segurança e privacidade

- As tabelas principais têm Row Level Security (RLS) ativa.
- Os buckets de fotografias, comprovativos e anexos estão configurados como privados.
- A consulta pública não deve devolver nome, email, telefone, fotografias ou outros dados do proprietário.
- As Edge Functions administrativas validam o token de sessão e o registo do utilizador na tabela `admin_users`.

Estas verificações técnicas não substituem testes de segurança independentes nem uma avaliação jurídica de conformidade com o RGPD.

## Antes do lançamento público

- Executar testes funcionais com contas separadas de cliente e administrador.
- Testar acesso negado a dados de outro utilizador e a anexos privados.
- Definir e publicar a política de privacidade, termos de utilização, contacto do responsável pelo tratamento e prazos de conservação.
- Rever prevenção de abuso na consulta pública e monitorização de erros.
- Testar em telemóveis e navegadores comuns.
