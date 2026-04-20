import type { Stage5Pack } from '../types/pack';

export function exportPack(pack: Stage5Pack): void {
  const json = JSON.stringify(pack, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${pack.manual_id || 'pack'}_packs.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function loadPackFromFile(file: File): Promise<Stage5Pack> {
  const text = await file.text();
  const pack = JSON.parse(text) as Stage5Pack;

  // Basic validation of required top-level fields
  if (!pack.manual_id || !pack.display_title || !Array.isArray(pack.questions)) {
    throw new Error('Invalid pack structure: missing required fields (manual_id, display_title, or questions array)');
  }

  return pack;
}
