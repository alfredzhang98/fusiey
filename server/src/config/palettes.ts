import { Color } from '../types';

export const PERLER_PALETTE: Color[] = [
  { id: 'p1', name: 'White', hex: '#FFFFFF', code: '01', brand: 'Perler' },
  { id: 'p2', name: 'Black', hex: '#000000', code: '18', brand: 'Perler' },
  { id: 'p3', name: 'Red', hex: '#B72228', code: '05', brand: 'Perler' },
  { id: 'p4', name: 'Orange', hex: '#F05F22', code: '04', brand: 'Perler' },
  { id: 'p5', name: 'Yellow', hex: '#F9D800', code: '03', brand: 'Perler' },
  { id: 'p6', name: 'Green', hex: '#319243', code: '10', brand: 'Perler' },
  { id: 'p7', name: 'Blue', hex: '#2B4B9B', code: '08', brand: 'Perler' },
  { id: 'p8', name: 'Purple', hex: '#633A8C', code: '13', brand: 'Perler' },
  { id: 'p9', name: 'Pink', hex: '#E65D96', code: '06', brand: 'Perler' },
  { id: 'p10', name: 'Brown', hex: '#6D4232', code: '12', brand: 'Perler' },
  { id: 'p11', name: 'Grey', hex: '#8E9194', code: '17', brand: 'Perler' },
  { id: 'p12', name: 'Peach', hex: '#F8B195', code: '33', brand: 'Perler' },
  { id: 'p13', name: 'Tan', hex: '#C69C6D', code: '35', brand: 'Perler' },
  { id: 'p14', name: 'Cheddar', hex: '#F7A000', code: '57', brand: 'Perler' },
  { id: 'p15', name: 'Kiwi Lime', hex: '#8CC63F', code: '61', brand: 'Perler' },
  { id: 'p16', name: 'Sky Blue', hex: '#00AEEF', code: '62', brand: 'Perler' },
  { id: 'p17', name: 'Light Blue', hex: '#8FB7D8', code: '09', brand: 'Perler' },
  { id: 'p18', name: 'Pastel Blue', hex: '#A2C9E8', code: '52', brand: 'Perler' },
  { id: 'p19', name: 'Toothpaste', hex: '#96DED1', code: '101', brand: 'Perler' },
  { id: 'p20', name: 'Light Green', hex: '#78C142', code: '11', brand: 'Perler' },
  { id: 'p21', name: 'Dark Grey', hex: '#5E6164', code: '92', brand: 'Perler' },
  { id: 'p22', name: 'Sand', hex: '#D9B99B', code: '10', brand: 'Perler' },
  { id: 'p23', name: 'Buttercup', hex: '#F6E366', code: '103', brand: 'Perler' },
  { id: 'p24', name: 'Plum', hex: '#914E72', code: '105', brand: 'Perler' },
  { id: 'p25', name: 'Cobalt', hex: '#1B3F8B', code: '151', brand: 'Perler' },
  { id: 'p26', name: 'Pastel Lavender', hex: '#B297C8', code: '54', brand: 'Perler' },
  { id: 'p27', name: 'Pastel Yellow', hex: '#FFF9AF', code: '56', brand: 'Perler' },
  { id: 'p28', name: 'Pastel Green', hex: '#98D2A5', code: '53', brand: 'Perler' },
];

export const HAMA_PALETTE: Color[] = [
  { id: 'h1', name: 'White', hex: '#FFFFFF', code: '01', brand: 'Hama' },
  { id: 'h2', name: 'Black', hex: '#000000', code: '18', brand: 'Hama' },
  { id: 'h3', name: 'Cream', hex: '#F0E8B9', code: '02', brand: 'Hama' },
  { id: 'h4', name: 'Yellow', hex: '#F9D800', code: '03', brand: 'Hama' },
  { id: 'h5', name: 'Orange', hex: '#F05F22', code: '04', brand: 'Hama' },
  { id: 'h6', name: 'Red', hex: '#B72228', code: '05', brand: 'Hama' },
  { id: 'h7', name: 'Pink', hex: '#E65D96', code: '06', brand: 'Hama' },
  { id: 'h8', name: 'Blue', hex: '#2B4B9B', code: '08', brand: 'Hama' },
];

export const PALETTES = [
  { id: 'perler', name: 'Perler Classic', colors: PERLER_PALETTE },
  { id: 'hama', name: 'Hama Midi', colors: HAMA_PALETTE },
];
