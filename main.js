/* Para onde o formulário envia. Vazio ou fora do ar: o visitante recebe o
   caminho do WhatsApp em vez de um erro seco. */
const FORM_ENDPOINT = 'enviar.php';
const WHATSAPP_NUMERO = '5554991595375';

document.addEventListener('DOMContentLoaded', () => {
  // Preload all brand backgrounds and SVGs immediately to avoid black flashes
  preloadAllBrandAssets();

  // Showcase Grid — Synchronized Two-Group Alternating Slider
  initGridCardSliders();

  // Jornada — cenas presas no scroll
  initJourney();

  // Contato — validação, máscara e envio
  initForm();
});

/* ==========================================================================
   Jornada
   A seção é alta e o palco dentro dela é sticky: enquanto ela passa, o scroll
   não arrasta nada, ele avança um relógio. Cada cena ocupa uma fatia desse
   relógio (data-hold, em telas de scroll) e recebe um único número, --p, com
   o seu próprio avanço. O CSS deriva dele todo o aparecimento, então um
   quadro de scroll custa duas ou três escritas de estilo, não um layout.
   ========================================================================== */
function initJourney() {
  const journey = document.querySelector('.journey');
  if (!journey) return;

  const stage = journey.querySelector('.journey-stage');
  const all = Array.from(journey.querySelectorAll('.scene'));
  if (!stage || !all.length) return;

  // Sem animação: a seção fica empilhada e inteira, como está no HTML
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  all.forEach(splitWords);
  all.forEach(spreadSequence);

  const wide = window.matchMedia('(min-width: 981px)');
  journey.classList.add('js-journey');

  let scenes = [];
  let total = 1;
  let span = 1;
  let vu = 0;        // altura de referência, em pixels, congelada
  let larguraVu = 0; // largura em que essa altura foi medida

  // No navegador do Instagram (e no Safari, e no Chrome do Android) a barra
  // some e volta quando o scroll muda de sentido. Isso muda a altura da
  // viewport no meio do gesto: se a jornada fosse medida em vh, a página
  // inteira mudaria de tamanho e a cena pularia. Então a altura é medida
  // uma vez, em pixels, e só é refeita quando a LARGURA muda — o que
  // acontece ao girar o aparelho, e não ao esconder a barra nem ao abrir
  // o teclado.
  function medirVu() {
    if (window.innerWidth === larguraVu) return false;
    larguraVu = window.innerWidth;
    vu = window.innerHeight;
    document.documentElement.style.setProperty('--vu', vu + 'px');
    return true;
  }

  // Monta a lista de cenas válidas para a largura atual e reparte o relógio
  function layout() {
    const desktop = wide.matches;
    let start = 0;
    scenes = [];

    all.forEach(el => {
      const only = el.dataset.only;
      const on = !only || (only === 'desktop') === desktop;
      el.hidden = !on;
      if (!on) return;

      const hold = parseFloat(el.dataset.hold) || 1;
      scenes.push({
        el: el,
        inner: el.firstElementChild,
        start: start,
        hold: hold,
        last: el.classList.contains('scene--last'),
        // A cena do formulário é a que troca o fundo da tela: se ela
        // deslizasse, o painel claro entraria torto por cima do escuro
        still: el.hasAttribute('data-still'),
        // Entra sozinha, sem cruzar com a anterior
        solo: el.hasAttribute('data-solo'),
        fitMin: parseFloat(el.dataset.fitMin) || 0.6,
        v: -1,
        p: -1,
        w: -1
      });
      start += hold;
    });

    total = start || 1;
    journey.style.setProperty('--journey-len', (total + 1).toFixed(2));

    fit();
    measure();
  }

  // O palco não rola: o que não couber na altura dele encolhe até caber.
  // A conta usa vu, a altura com a barra do navegador à mostra — a menor
  // que a tela pode ter. Assim o que coube continua cabendo quando a barra
  // aparece de novo.
  function fit() {
    scenes.forEach(s => {
      if (!s.inner) return;
      s.inner.style.setProperty('--fit', '1');
      const cs = getComputedStyle(s.el);
      const avail = vu - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const h = s.inner.scrollHeight;
      const k = (h > avail && h > 0) ? Math.max(avail / h, s.fitMin) : 1;
      s.inner.style.setProperty('--fit', k.toFixed(3));
    });
  }

  function measure() {
    span = Math.max(journey.offsetHeight - vu, 1);
  }

  function smooth(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * (3 - 2 * t);
  }

  // Entra de -0.12 a 0.10 e sai de 0.90 a 1.12: as janelas de duas cenas
  // vizinhas se cruzam em volta da fronteira, então uma troca pela outra
  // sem passar por uma tela vazia. A última não sai — quem a leva embora
  // é o scroll normal da página, já indo para o formulário.
  function visibility(x, last, solo) {
    // A cena do formulário é um painel claro opaco: ela não aparece por
    // transparência, ela sobe por cima (ver --wipe). Se cruzasse por
    // opacidade, o texto verde da cena anterior sumiria no verde dela, e
    // apagar uma antes da outra deixaria um quadro preto entre as duas.
    if (solo) return x > -0.02 ? 1 : 0;

    if (x <= -0.12) return 0;
    if (x < 0.10) return smooth((x + 0.12) / 0.22);
    if (last || x < 0.90) return 1;
    if (x < 1.12) return smooth((1.12 - x) / 0.22);
    return 0;
  }

  function update() {
    // O avanço vem de onde a seção está NA TELA agora, não de scrollY menos
    // uma posição guardada. Quando o navegador esconde a barra ele mexe na
    // altura e às vezes no próprio scrollY; a posição na tela continua
    // dizendo a verdade, então a cena não pula.
    let p = -journey.getBoundingClientRect().top / span;
    if (p < -0.4) p = -0.4;
    if (p > 1.4) p = 1.4;

    const pos = p * total;
    journey.style.setProperty('--jp', Math.min(Math.max(p, 0), 1).toFixed(3));

    scenes.forEach(s => {
      const x = (pos - s.start) / s.hold;
      const v = visibility(x, s.last, s.solo);

      if (v !== s.v) {
        s.v = v;
        s.el.style.opacity = v;
        s.el.classList.toggle('is-on', v > 0.001);
        if (!s.still) {
          // Sobe entrando e continua subindo saindo, nunca volta atrás
          const shift = (x < 0.5 ? (1 - v) : (v - 1)) * 26;
          s.el.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
        }
      }

      if (v <= 0) return;

      // Painel que sobe: a borda de cima sobe do pé da tela até o topo
      if (s.solo) {
        let w = 1 - x / 0.18;
        w = w < 0 ? 0 : (w > 1 ? 1 : w);
        if (Math.abs(w - s.w) > 0.003) {
          s.w = w;
          s.el.style.setProperty('--wipe', w.toFixed(3));
        }
      }

      // O conteúdo termina de aparecer antes de a cena começar a sair
      let cp = x / 0.86;
      cp = cp < 0 ? 0 : (cp > 1 ? 1 : cp);
      if (Math.abs(cp - s.p) > 0.002) {
        s.p = cp;
        s.el.style.setProperty('--p', cp.toFixed(3));
      }
    });
  }

  let queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  }

  // Só refaz as contas quando a largura muda. Esconder a barra, girar a
  // rolagem ou abrir o teclado disparam resize sem mudar a largura, e
  // refazer o layout nessas horas é justamente o que fazia a página pular.
  let resizeTimer = 0;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (medirVu()) layout();
      update();
    }, 140);
  }

  medirVu();
  layout();
  update();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  if (wide.addEventListener) wide.addEventListener('change', onResize);

  // As medidas mudam quando as fontes do projeto substituem as de fallback
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { fit(); measure(); update(); });
  }
}

// Envolve cada palavra num <span class="w"> numerado, para o CSS poder
// acendê-las uma a uma. data-nosplit mantém o trecho inteiro como uma palavra.
function splitWords(scene) {
  scene.querySelectorAll('.scene-words').forEach(root => {
    let count = 0;

    (function walk(node) {
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 3) {
          if (!child.textContent.trim()) return;
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (!part.trim()) {
              frag.appendChild(document.createTextNode(part));
              return;
            }
            const word = document.createElement('span');
            word.className = 'w';
            word.style.setProperty('--i', count++);
            word.textContent = part;
            frag.appendChild(word);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          if (child.hasAttribute('data-nosplit')) {
            child.classList.add('w');
            child.style.setProperty('--i', count++);
          } else {
            walk(child);
          }
        }
      });
    })(root);

    root.style.setProperty('--n', count);
  });
}

// Percurso vertical: os blocos aparecem na ordem em que estão no HTML,
// repartidos ao longo do avanço da cena
function spreadSequence(scene) {
  scene.querySelectorAll('[data-sequence]').forEach(list => {
    const items = Array.from(list.children).filter(el => el.classList.contains('rv'));
    const last = Math.max(items.length - 1, 1);
    items.forEach((el, i) => {
      el.style.setProperty('--at', (0.03 + (i / last) * 0.74).toFixed(3));
    });
  });
}

/* ==========================================================================
   Contato
   ========================================================================== */
function initForm() {
  const form = document.getElementById('form-contato');
  if (!form) return;

  const msg = document.getElementById('form-msg');
  const inputs = Array.from(form.querySelectorAll('.field input'));
  const phone = form.querySelector('input[type="tel"]');

  if (phone) {
    phone.addEventListener('input', () => {
      phone.value = maskPhone(phone.value);
    });
  }

  inputs.forEach(input => {
    input.addEventListener('input', () => {
      input.closest('.field').classList.remove('is-invalid');
    });
  });

  form.addEventListener('submit', event => {
    event.preventDefault();
    if (form.classList.contains('is-sending')) return;

    let firstBad = null;
    inputs.forEach(input => {
      const ok = isValid(input);
      input.closest('.field').classList.toggle('is-invalid', !ok);
      if (!ok && !firstBad) firstBad = input;
    });

    if (firstBad) {
      setMessage(msg, 'Confira os campos destacados antes de enviar.');
      firstBad.focus();
      return;
    }

    setMessage(msg, '');
    form.classList.add('is-sending');

    const lead = {
      nome: form.nome.value.trim(),
      nicho: form.nicho.value.trim(),
      email: form.email.value.trim(),
      telefone: form.telefone.value.trim(),
      site: form.site ? form.site.value : '',
      origem: location.href
    };

    sendLead(lead).then(ok => {
      if (ok) {
        window.location.href = 'obrigado.html';
        return;
      }
      form.classList.remove('is-sending');
      setMessage(
        msg,
        'Não consegui enviar agora. Me chame no WhatsApp: ',
        whatsappLink(lead)
      );
    });
  });
}

function sendLead(lead) {
  if (!FORM_ENDPOINT) return Promise.resolve(false);

  return fetch(FORM_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(lead)
  })
    .then(response => (response.ok ? response.json() : null))
    .then(data => !!(data && data.ok))
    .catch(() => false);
}

function whatsappLink(lead) {
  const texto = 'Olá, Pedro. Vim pelo site.\n'
    + 'Nome: ' + lead.nome + '\n'
    + 'Nicho: ' + lead.nicho + '\n'
    + 'E-mail: ' + lead.email;
  return 'https://wa.me/' + WHATSAPP_NUMERO + '?text=' + encodeURIComponent(texto);
}

function setMessage(el, text, href) {
  if (!el) return;
  el.textContent = text;
  if (href) {
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'abrir conversa';
    el.appendChild(link);
  }
  el.hidden = !text;
}

function isValid(input) {
  const value = input.value.trim();
  if (!value) return false;
  if (input.type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
  if (input.type === 'tel') return value.replace(/\D/g, '').length >= 10;
  return value.length >= 2;
}

function maskPhone(value) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (!d) return '';
  if (d.length <= 2) return '(' + d;
  if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
  if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
  return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
}

/* ==========================================================================
   Grid de marcas
   ========================================================================== */

// Preloads and decodes every single image and SVG on page load
function preloadAllBrandAssets() {
  const allImages = Array.from(document.querySelectorAll('.branding-grid img'));

  allImages.forEach(img => {
    // Force immediate browser fetching
    const src = img.getAttribute('src');
    if (src) {
      const preloader = new Image();
      preloader.src = src;
      if ('decode' in preloader) {
        preloader.decode().catch(() => {});
      }
    }
  });
}

function initGridCardSliders() {
  const cards = Array.from(document.querySelectorAll('.grid-card.has-slides'));
  if (!cards.length) return;

  const INTERVAL = 2800; // ms por slide
  const OFFSET = INTERVAL / 2; // Grupo B começa meio ciclo depois

  // Separa em Grupo A (ímpares: index 0,2,4...) e Grupo B (pares: index 1,3,5...)
  const groupA = cards.filter((_, i) => i % 2 === 0);
  const groupB = cards.filter((_, i) => i % 2 !== 0);

  // Prepara o estado de cada card: índice atual do slide
  const state = new Map();
  cards.forEach(card => {
    state.set(card, 0);
  });

  function advanceGroup(group) {
    group.forEach(card => {
      const slides = card.querySelectorAll('.card-slide');
      if (slides.length <= 1) return;

      const current = state.get(card);
      const next = (current + 1) % slides.length;

      const nextSlide = slides[next];
      const nextBg = nextSlide.querySelector('.slide-bg');

      // Se a imagem seguinte ainda não carregou no navegador, não avança para evitar flash preto
      if (nextBg && !nextBg.complete) {
        return;
      }

      const currentSlide = slides[current];

      // Limpa quem saiu na troca anterior e já está coberto
      slides.forEach(slide => {
        if (slide !== currentSlide) slide.classList.remove('is-leaving');
      });

      // O atual passa a recuar por baixo; o próximo entra por cima.
      // Tirar is-entering antes de recolocar reinicia a animação
      // quando o card só tem dois slides e eles se revezam.
      currentSlide.classList.remove('active', 'is-entering');
      currentSlide.classList.add('is-leaving');

      nextSlide.classList.remove('is-leaving');
      nextSlide.classList.add('active', 'is-entering');

      state.set(card, next);
    });
  }

  // Grupo A começa imediatamente e troca a cada INTERVAL
  setInterval(() => advanceGroup(groupA), INTERVAL);

  // Grupo B começa após meio ciclo (OFFSET), também a cada INTERVAL
  setTimeout(() => {
    setInterval(() => advanceGroup(groupB), INTERVAL);
  }, OFFSET);
}
