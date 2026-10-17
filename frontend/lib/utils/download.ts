/**
 * Enregistre un blob côté navigateur via une URL objet temporaire, révoquée
 * aussitôt après le clic (jamais de fuite d'URL même si le clic échoue).
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
