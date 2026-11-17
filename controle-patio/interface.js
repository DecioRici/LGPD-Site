'use strict';
(() => {
  const descriptions = {
    kanban: 'Acompanhe os veículos em cada etapa do atendimento.',
    dashboard: 'Consulte a distribuição dos veículos e os tempos na operação.',
    history: 'Consulte as movimentações registradas ao longo do atendimento.',
    database: 'Localize os cadastros e consulte os dados de cada veículo.',
    field: 'Consulte os tempos registrados no levantamento dos cinco caminhões.'
  };
  document.querySelectorAll('.tab[data-view]').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab[data-view]').forEach(item => {
        if (item === tab) item.setAttribute('aria-current', 'page');
        else item.removeAttribute('aria-current');
      });
      document.querySelector('#page-description').textContent = descriptions[tab.dataset.view] || '';
    });
  });
  const board = document.querySelector('#board');
  const previous = document.querySelector('#board-prev');
  const next = document.querySelector('#board-next');
  function updateArrows() {
    previous.disabled = board.scrollLeft <= 2;
    next.disabled = board.scrollLeft + board.clientWidth >= board.scrollWidth - 2;
  }
  function shift(direction) {
    board.scrollBy({ left: direction * Math.max(245, board.clientWidth * .7), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  previous.addEventListener('click', () => shift(-1));
  next.addEventListener('click', () => shift(1));
  board.addEventListener('scroll', updateArrows, { passive: true });
  window.addEventListener('resize', updateArrows);
  document.querySelector('[data-view="kanban"]').addEventListener('click', () => requestAnimationFrame(updateArrows));
  updateArrows();
})();
