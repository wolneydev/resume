# Wolney Cesar Carneiro — Portfolio

Site de apresentação profissional (PT-BR / EN) de **Wolney Cesar Carneiro**, Desenvolvedor de Software Sênior.

- `index.html` (HTML5 semântico), `css/style.css` e `js/main.js` — mobile-first, sem dependências de build
- Tema de cores: [Everforest Dark](https://github.com/sainnhe/everforest)
- Seletor de idioma PT/EN com lembrança da preferência
- Currículos para download em `cv/`

## Fig. 1 — Anatomia de uma requisição

A figura isométrica interativa do topo é gerada por `tools/figure/` (kit isométrico + `live.js` + `figure.css`).
O build escreve `css/anatomy.css`, `js/request-figure.js` e o SVG entre `<!-- fig:start -->` e `<!-- fig:end -->` no `index.html`:

```bash
node tools/figure/build.mjs
```

Edite os arquivos em `tools/figure/`, não os gerados.

## Rodar localmente

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Contato

- LinkedIn: [in/wolney-carneiro-10w](https://www.linkedin.com/in/wolney-carneiro-10w)
- GitHub: [wolneydev](https://github.com/wolneydev)
- E-mail: wolney.dev@gmail.com
