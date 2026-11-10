# Controle Pessoal

Aplicativo pessoal de controle financeiro, com a mesma base de código para
**web**, **Linux** e **Windows**.

- **Versão web:** https://myttoz.github.io/controle-pessoal/
  (disponível após a primeira publicação no GitHub Pages)
- **Login obrigatório:** os dados só aparecem depois de autenticar.
- **Sincronização:** lançamentos, salário, horas extras, férias e manutenção
  ficam na planilha do Google e são sincronizados entre os aparelhos.
- **Offline:** o app desktop continua funcionando sem internet e envia as
  alterações quando a conexão volta. A versão web também guarda alterações
  pendentes enquanto a página estiver aberta.

## Versões

| Plataforma | Formato |
|---|---|
| Web | GitHub Pages |
| Linux | `.AppImage` e `.deb` |
| Windows | instalador `.exe` (NSIS) |

Os instaladores são gerados pelo GitHub Actions em **Actions → Gerar
instaladores (Linux + Windows)**.

## Privacidade

Este repositório é público apenas para permitir a hospedagem gratuita da
versão web no GitHub Pages. Os dados financeiros ficam na planilha privada do
Google e são acessados somente após login. A chave da API **não** fica no
front-end: o Apps Script a injeta no servidor durante o proxy autenticado.

## Documentação

- Passo a passo de atualização e publicação: [PASSO-A-PASSO-ATUALIZACAO.txt](PASSO-A-PASSO-ATUALIZACAO.txt)
- Documentação antiga da API: [DOCUMENTACAO-API.md](DOCUMENTACAO-API.md)
