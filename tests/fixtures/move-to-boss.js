(() => {
  const emit = (type, code, key) => window.dispatchEvent(new KeyboardEvent(type, {
    code,
    key,
    bubbles: true,
  }));
  emit('keydown', 'ArrowRight', 'ArrowRight');
  setTimeout(() => emit('keydown', 'Space', ' '), 1250);
  setTimeout(() => emit('keyup', 'Space', ' '), 1370);
  setTimeout(() => emit('keydown', 'KeyK', 'k'), 1510);
  setTimeout(() => emit('keyup', 'KeyK', 'k'), 1580);
  setTimeout(() => emit('keyup', 'ArrowRight', 'ArrowRight'), 3500);
  return 'MOVING_TO_BOSS';
})();
