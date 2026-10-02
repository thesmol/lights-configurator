export const catalog = {
  tracks: [
    { id: 'surface', name: 'Накладной трек 48V', description: 'На поверхность потолка', unitLength: 1, price: 4200 },
    { id: 'recessed', name: 'Встроенный трек 48V', description: 'Вровень с потолком', unitLength: 1, price: 5600 },
  ],
  fixtures: [
    { id: 'spot', name: 'SPOT 48', type: 'Направленный', watts: 12, lumens: 900, beam: 36, price: 8900, icon: '◉' },
    { id: 'wide', name: 'WIDE 48', type: 'Широкий луч', watts: 16, lumens: 1250, beam: 60, price: 10900, icon: '◍' },
    { id: 'line', name: 'LINE 48', type: 'Линейный', watts: 20, lumens: 1600, beam: 100, price: 13900, icon: '▰' },
  ],
  accessories: [
    { id: 'power', name: 'Блок питания', price: 6900, quantity: 1 },
    { id: 'connector', name: 'Коннектор', price: 950, quantity: 2 },
  ],
  demo: true,
};

export function quote(input) {
  const track = catalog.tracks.find(x => x.id === input.mount);
  const length = Number(input.trackL);
  if (!track || !Number.isFinite(length) || length < 0.8 || length > 12 || !Array.isArray(input.fixtures) || input.fixtures.length > 40) {
    throw new Error('Недопустимые параметры конфигурации');
  }
  const ids = input.fixtures.map(f => f?.type);
  if (ids.some(id => !catalog.fixtures.some(f => f.id === id))) throw new Error('Неизвестный светильник');
  const railCount = Math.ceil(length / track.unitLength);
  const items = [{ id: track.id, name: track.name, description: `Секции по ${track.unitLength} м`, quantity: railCount, unitPrice: track.price, total: railCount * track.price }];
  for (const fixture of catalog.fixtures) {
    const quantity = ids.filter(id => id === fixture.id).length;
    if (quantity) items.push({ id: fixture.id, name: fixture.name, description: `${fixture.type} · ${fixture.watts} Вт`, quantity, unitPrice: fixture.price, total: quantity * fixture.price });
  }
  for (const accessory of catalog.accessories) items.push({ id: accessory.id, name: accessory.name, description: 'Комплект подключения', quantity: accessory.quantity, unitPrice: accessory.price, total: accessory.quantity * accessory.price });
  return { items, total: items.reduce((sum, item) => sum + item.total, 0), watts: ids.reduce((sum, id) => sum + catalog.fixtures.find(f => f.id === id).watts, 0), lumens: ids.reduce((sum, id) => sum + catalog.fixtures.find(f => f.id === id).lumens, 0), fixtureCount: ids.length, demo: true };
}
