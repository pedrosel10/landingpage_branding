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
});

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


