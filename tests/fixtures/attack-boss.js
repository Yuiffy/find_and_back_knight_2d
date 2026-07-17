(() => {
  const emit = (type, code, key) => window.dispatchEvent(new KeyboardEvent(type, {
    code,
    key,
    bubbles: true,
  }));
  for (let index = 0; index < 12; index += 1) {
    setTimeout(() => emit('keydown', 'KeyB', 'b'), index * 245);
    setTimeout(() => emit('keyup', 'KeyB', 'b'), index * 245 + 70);
  }
  return 'ATTACKING_BOSS';
})();
