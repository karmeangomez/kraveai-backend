// Simulación básica de interacción humana
export function humanInteraction(page) {
  return page.mouse.move(
    Math.floor(Math.random() * 100),
    Math.floor(Math.random() * 100),
    { steps: 10 }
  );
}
