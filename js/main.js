(function(){
  document.body.classList.remove('no-js');
  var EN = {
    "skip":"Skip to content",
    "nav.about":"about","nav.stack":"stack","nav.projects":"projects","nav.exp":"experience","nav.contact":"contact",
    "hero.role":"Senior Software Developer · Backend & Architecture",
    "hero.lead":"9+ years building, modernizing and operating corporate and government systems in production. Backend specialist in PHP/Laravel, RESTful APIs, software architecture and CI/CD — with AI-accelerated development (Claude Code and Cursor) and MCP servers in personal projects.",
    "stat.years":"years of experience","stat.cos":"companies · public & private sector","stat.release":"months cut from release time","stat.pipes":"apps with CI/CD pipelines I built",
    "cta.contact":"Get in touch","cta.cv":"Download resume",
    "about.eyebrow":"about me","about.title":"Solid engineering, systems that last",
    "about.p1":"I'm a Senior Software Developer and former Software Architect based in São Paulo, Brazil. My work spans large-scale government systems serving Brazilian citizens, including healthcare and legal management platforms for public agencies.",
    "about.p2":"I focus on turning complex — often legacy — systems into sustainable codebases: clear architecture patterns, automated tests, reliable delivery pipelines and well-documented APIs.",
    "about.p3":"I also use AI as a real part of the engineering workflow: CLI and IDE agents for refactoring, code review and testing, and, in personal projects, Model Context Protocol (MCP) integrations built in Laravel.",
    "about.f1":"São Paulo, SP — Brazil","about.f2":"B.Sc. Information Systems · Postgraduate in Project Management","about.f3":"Certified Scrum Developer® (CSD) — 2024","about.f4":"Portuguese native · English fluent",
    "pil.1t":"Seniority","pil.1d":"9+ years in production, technical leadership of 4 engineers and standards adopted across projects.",
    "pil.2t":"Software Architecture","pil.2d":"SOLID, architecture patterns, reusable scaffolds, RabbitMQ messaging and component decoupling.",
    "pil.3t":"System Modernization","pil.3d":"Migrating and evolving legacy platforms into SPAs with REST APIs, Redis caching and optimized SQL.",
    "pil.4t":"AI Integration","pil.4d":"Claude Code, Cursor, an MCP server in Laravel (personal project) and autonomous development and testing workflows.",
    "stack.eyebrow":"tech stack & skills","stack.title":"Tools I use every day","stack.db":"Databases","stack.ai":"AI & Quality","stack.method":"Methodologies",
    "t.rest":"RESTful APIs","t.patterns":"Architecture patterns","t.legacy":"Legacy modernization","t.deploy":"Automated deployments","t.model":"Data modeling","t.sqlopt":"SQL optimization","t.lead":"Technical leadership","t.pm":"Project management","t.micro":"Microservices",
    "proj.eyebrow":"featured projects","proj.title":"Work that made an impact",
    "proj.k.ai":"Personal project · AI · MCP","proj.k.gov":"Public sector · Federal","proj.k.arch":"Architecture","proj.k.health":"Public sector · Healthcare & Legal","proj.k.dist":"Distributed systems","proj.k.city":"Public sector · Municipal","proj.k.crm":"Private sector · CRM",
    "proj.gh":"View on GitHub →","proj.private":"Corporate project · private code","proj.poc":"Internal proof of concept",
    "proj.1t":"MCP Server in Laravel","proj.1d":"Personal project: a custom Model Context Protocol server exposing specialized tools as a conversational alternative to web forms — frontend clients handle platform registrations through AI agents.",
    "proj.2t":"Citizen service case management","proj.2d":"Case management system for citizen requests at a federal agency: workflows, reporting and REST integrations between systems, shipped frequently via GitLab CI/CD and Argo CD on AWS.",
    "proj.3t":"Reusable Laravel scaffolds","proj.3d":"Scaffolds that standardized project structure and automated application layers, adopted across two major projects — cutting release time by six months.",
    "proj.4t":"Healthcare & legal management platforms","proj.4d":"Platforms for public agencies in healthcare and legal management: Vue.js frontends and Laravel REST APIs, Redis caching to reduce database load and Swagger/OpenAPI docs, supporting legacy system modernization.",
    "proj.5t":"Async messaging with RabbitMQ","proj.5d":"Proofs of concept for asynchronous service-to-service communication, evaluating messaging strategies and decoupling patterns for distributed architectures.",
    "proj.7t":"Corporate CRM","proj.7d":"Enterprise CRM system: delivered new features with a Vue.js frontend and Laravel REST APIs, integrations with other corporate systems and continuous evolution of the platform.",
    "proj.6t":"Municipal management systems","proj.6d":"Contract management and service desk systems used by two agencies, plus solutions for public works, street lighting, monuments and municipal events.",
    "exp.eyebrow":"experience","exp.title":"Professional experience",
    "exp.1d":"Mar 2024 — Mar 2026","exp.1r":"Senior Software Developer",
    "exp.1a":"Maintained and evolved a large-scale government system serving Brazilian citizens.","exp.1b":"Architectural improvements and new features, reducing defects and incidents.","exp.1c":"Automated build, test and deployment with GitLab CI/CD and Argo CD on AWS environments.","exp.1e":"PHPUnit unit tests to prevent regressions.",
    "exp.2d":"Sep 2019 — Apr 2024","exp.2r":"Software Architect (Mid-level)",
    "exp.2a":"Defined architecture and development standards across two major projects, leading four engineers.","exp.2b":"Reusable Laravel scaffolds that cut release time by six months.","exp.2c":"GitLab CI pipelines for build, test and deployment of four applications.","exp.2e":"Corporate CRM plus healthcare and legal platforms for public agencies in Vue.js + Laravel, Redis caching, RabbitMQ PoCs and Swagger-documented APIs.",
    "exp.3d":"Jul 2016 — Sep 2019","exp.3r":"Systems Analyst","exp.3n":"Through contracted service providers",
    "exp.3a":"Web systems for public sector institutions using PHP, JavaScript, jQuery and Bootstrap.","exp.3b":"Contract management and service desk systems used by two agencies.","exp.3c":"REST API and web service integrations; maintained and migrated legacy systems.","exp.3e":"SQL query optimization on MySQL and SQL Server.",
    "edu.title":"Education","edu.1":"B.Sc. in Information Systems","edu.2":"Postgraduate Certificate in Project Management",
    "cert.title":"Certifications & courses","cert.sep":"Sep 2024","cert.fc":"Hexagonal Architecture, Event Storming, RabbitMQ, Docker, Architecture Fundamentals, SOLID",
    "contact.eyebrow":"contact","contact.title":"Let's talk?","contact.lead":"Open to Senior Developer, Tech Lead or Software Architect roles — remote or hybrid, in Brazil or abroad.",
    "contact.cvpt":"Resume · Portuguese","contact.cven":"Resume · English","footer":"theme"
  };
  var nodes = document.querySelectorAll('[data-i18n]'), PT = {};
  nodes.forEach(function(n){ PT[n.getAttribute('data-i18n')] = n.textContent; });
  var cvBtn = document.querySelector('[data-cv]');
  function setLang(l){
    var dict = l === 'en' ? EN : PT;
    nodes.forEach(function(n){ var k=n.getAttribute('data-i18n'); if(dict[k]) n.textContent = dict[k]; });
    document.documentElement.lang = l === 'en' ? 'en' : 'pt-BR';
    document.title = l === 'en' ? 'Wolney Cesar Carneiro — Senior Software Developer' : 'Wolney Cesar Carneiro — Desenvolvedor de Software Sênior';
    cvBtn.href = l === 'en' ? 'cv/Wolney_Carneiro_CV_EN.pdf' : 'cv/Wolney_Carneiro_CV_PT.pdf';
    document.querySelectorAll('[data-lang]').forEach(function(b){ b.setAttribute('aria-pressed', b.dataset.lang === l); });
    try{ localStorage.setItem('lang', l); }catch(e){}
  }
  document.querySelectorAll('[data-lang]').forEach(function(b){ b.addEventListener('click', function(){ setLang(b.dataset.lang); }); });
  var saved = null; try{ saved = localStorage.getItem('lang'); }catch(e){}
  var initial = saved || (/^pt/i.test(navigator.language || 'pt') ? 'pt' : 'en');
  if(initial === 'en') setLang('en');

  document.getElementById('yr').textContent = new Date().getFullYear();

  var els = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } }); }, {threshold:.12});
    els.forEach(function(el){ io.observe(el); });
  } else { els.forEach(function(el){ el.classList.add('in'); }); }
})();
