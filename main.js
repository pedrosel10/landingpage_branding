document.addEventListener('DOMContentLoaded', () => {
  const btnContato = document.getElementById('btn-contato');
  
  if (btnContato) {
    btnContato.addEventListener('click', (e) => {
      console.log('CTA clicked: Entrar em contato');
    });
  }

  // Preload all brand backgrounds and SVGs immediately to avoid black flashes
  preloadAllBrandAssets();

  // Showcase Grid — Synchronized Two-Group Alternating Slider
  initGridCardSliders();

  // Método — revela a linha do tempo quando entra na viewport
  initMethodReveal();

  // Slides — caixa de seleção que acende uma imagem por vez
  initSlidesSpotlight();
});

function initSlidesSpotlight() {
  const section = document.querySelector('.slides');
  if (!section) return;

  const items = Array.from(section.querySelectorAll('.slides-item'));
  if (!items.length) return;

  // Só apaga a esteira depois de garantir que a caixa vai funcionar
  section.classList.add('is-spotlight');

  const DWELL = 2800;   // tempo parado em cada imagem
  const MARGIN = 0.14;  // zona segura: 14% de cada lado ficam fora de jogo
  const TICK = 200;

  let current = null;
  let litAt = 0;
  let visible = true;

  // Imagem inteira dentro da faixa central da tela, longe das bordas
  function inSafeZone(el) {
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    return rect.left > vw * MARGIN && rect.right < vw * (1 - MARGIN);
  }

  function pick() {
    const currentSrc = current ? current.querySelector('img').getAttribute('src') : null;

    const pool = items.filter(el => {
      if (el === current) return false;
      if (currentSrc && el.querySelector('img').getAttribute('src') === currentSrc) return false;
      return inSafeZone(el);
    });
    if (!pool.length) return null;

    // Prefere saltar para outra faixa, para a caixa não andar só na horizontal
    const currentRow = current ? current.parentElement : null;
    const otherRows = pool.filter(el => el.parentElement !== currentRow);
    const from = otherRows.length ? otherRows : pool;

    return from[Math.floor(Math.random() * from.length)];
  }

  function jump() {
    const next = pick();
    if (!next) return;

    if (current) current.classList.remove('is-lit');
    current = next;
    current.classList.add('is-lit');
    litAt = performance.now();
  }

  // Não gasta trabalho enquanto a dobra está fora da tela
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
    }, { threshold: 0 }).observe(section);
  }

  jump();

  setInterval(() => {
    if (!visible) return;
    if (!current) {
      jump();
      return;
    }
    // Troca no fim do tempo, ou antes se a imagem estiver chegando na borda
    if (performance.now() - litAt > DWELL || !inSafeZone(current)) jump();
  }, TICK);
}

function initMethodReveal() {
  const section = document.querySelector('.method');
  if (!section) return;

  if (!('IntersectionObserver' in window)) return;

  // Só esconde depois de garantir que o observer vai revelar
  section.classList.add('js-reveal');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  observer.observe(section);
}

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

      slides[current].classList.remove('active');
      state.set(card, next);
      nextSlide.classList.add('active');
    });
  }

  // Grupo A começa imediatamente e troca a cada INTERVAL
  setInterval(() => advanceGroup(groupA), INTERVAL);

  // Grupo B começa após meio ciclo (OFFSET), também a cada INTERVAL
  setTimeout(() => {
    setInterval(() => advanceGroup(groupB), INTERVAL);
  }, OFFSET);
}


