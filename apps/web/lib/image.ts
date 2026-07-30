/**
 * Client-side image compression for profile photo uploads.
 *
 * Why: real users' uploads were failing. Phone photos are often 10-20 MB and/or
 * HEIC (iPhone default), which the API rejects (size + unsupported type). We
 * decode whatever the browser can render, draw it to a canvas at a sane max
 * dimension, and export a small JPEG - so the upload is always a modest
 * image/jpeg regardless of the source format or size, and it uploads fast.
 *
 * Falls back to the original file if the browser can't decode it (rare on
 * desktop for HEIC) so we never block an upload that might still succeed.
 */
export async function compressImageToJpeg(
  file: File,
  maxDim = 1024,
  quality = 0.85,
): Promise<{ blob: Blob; contentType: string }> {
  try {
    const dataUrl = await readAsDataUrl(file);
    const img = await decodeImage(dataUrl);

    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      const scale = Math.min(maxDim / width, maxDim / height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    );
    if (!blob || blob.size === 0) throw new Error('encode failed');
    return { blob, contentType: 'image/jpeg' };
  } catch {
    // Couldn't process it client-side - upload the original and let the API decide.
    return { blob: file, contentType: file.type || 'application/octet-stream' };
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error('read failed'));
    fr.readAsDataURL(file);
  });
}

function decodeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decode failed'));
    img.src = src;
  });
}
