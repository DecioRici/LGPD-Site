const metrics = [
  { value: '241', label: 'agendamentos válidos' },
  { value: '4h01', label: 'média de permanência' },
  { value: '2h04', label: 'mediana de permanência' },
  { value: '18', label: 'registros extremos' }
];

const flows = [
  { label: 'Expedição', value: 195 },
  { label: 'Matéria-prima', value: 46 }
];

document.querySelector('#metrics').innerHTML = metrics
  .map(item => `<article class="metric"><strong>${item.value}</strong><span>${item.label}</span></article>`)
  .join('');

const maximum = Math.max(...flows.map(item => item.value));
document.querySelector('#flow-chart').innerHTML = flows
  .map(item => `
    <div class="bar-row">
      <span>${item.label}</span>
      <div class="bar-track"><div class="bar-fill" data-width="${(item.value / maximum) * 100}"></div></div>
      <strong>${item.value}</strong>
    </div>`)
  .join('');

requestAnimationFrame(() => {
  document.querySelectorAll('.bar-fill').forEach(bar => {
    bar.style.width = `${bar.dataset.width}%`;
  });
});
