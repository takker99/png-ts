export interface Palette {
  red: number;
  green: number;
  blue: number;
}

export const toHexColor = (palette: Palette): `#${string}` => `#${hex(palette.red)}${hex(palette.green)}${hex(palette.blue)}`;

const hex = (n: number): string => n.toString(16).padStart(2, "0");