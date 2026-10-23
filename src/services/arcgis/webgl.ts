/** True when the browser can create a WebGL2 context (required by ArcGIS Maps SDK 5.1). */
export function detectWebGL2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!canvas.getContext("webgl2");
  } catch {
    return false;
  }
}
