document.addEventListener('DOMContentLoaded', () => {
  const heroBg = document.querySelector('.hero-bg');
  const heroContent = document.querySelector('.hero-content');
  const turbulence = document.querySelector('#turbulence');

  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  
  const ease = 0.015;

  document.addEventListener('mousemove', (e) => {
    targetX = (window.innerWidth / 2 - e.clientX) * 0.015;
    targetY = (window.innerHeight / 2 - e.clientY) * 0.015;
  });

  function animateParallax() {
    currentX += (targetX - currentX) * ease;
    currentY += (targetY - currentY) * ease;

    if (heroBg) {
      heroBg.style.transform = `translate(${currentX}px, ${currentY}px) scale(1.03)`;
    }
    
    if (heroContent) {
      heroContent.style.transform = `translate(${-currentX * 0.8}px, ${-currentY * 0.8}px)`;
    }

    requestAnimationFrame(animateParallax);
  }
  
  animateParallax();

  if (turbulence) {
    let time = 0;
    function animateWaves() {
      time += 0.002;
      const baseFreqX = 0.008 + Math.sin(time) * 0.002;
      const baseFreqY = 0.02 + Math.cos(time * 0.8) * 0.005;
      turbulence.setAttribute('baseFrequency', `${baseFreqX.toFixed(5)} ${baseFreqY.toFixed(5)}`);
      requestAnimationFrame(animateWaves);
    }
    animateWaves();
  }
});
