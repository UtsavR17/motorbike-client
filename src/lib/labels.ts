/** "Honda CB Shine 125cc" stays as is; "Duke" becomes "KTM Duke". */
export function modelLabel(brand: string, model: string): string {
  return model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${brand} ${model}`;
}

/** Label for a part variant's size; a missing size is the standard fitment. */
export function sizeLabel(size: string | null | undefined): string {
  const s = (size ?? '').trim();
  return s === '' ? 'Standard' : s;
}
