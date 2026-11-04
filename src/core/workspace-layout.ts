/** Desktop workspace geometry, in CSS pixels (DIPs at the default WebView2 scale).
 * Output pixels are independent and are never changed by a window resize.
 */
export const WORKSPACE = {
  horizontalPadding: 10,
  verticalPadding: 2,
  columnGap: 12,
  frameInset: 3,
  transportHeight: 48,
  minimumPreviewWidth: 360,
  minimumEditorWidth: 240,
} as const;

export interface WorkspaceLayout {
  previewWidth: number;
  previewHeight: number;
  frameWidth: number;
  frameHeight: number;
  editorWidth: number;
  minimumClientWidth: number;
  minimumClientHeight: number;
  fits: boolean;
}

export function getWorkspaceLayout(clientWidth: number, clientHeight: number, outputWidth: number, outputHeight: number): WorkspaceLayout {
  if (![clientWidth,clientHeight,outputWidth,outputHeight].every(Number.isFinite) || outputWidth<=0 || outputHeight<=0) {
    throw Error('Invalid workspace or output size');
  }
  const p=WORKSPACE;
  const aspect=outputHeight/outputWidth;
  const frameExtra=2*p.frameInset;
  const minimumClientWidth=2*p.horizontalPadding+p.minimumPreviewWidth+frameExtra+p.columnGap+p.minimumEditorWidth;
  const minimumClientHeight=2*p.verticalPadding+p.minimumPreviewWidth*aspect+p.transportHeight+frameExtra;
  const availableWidth=clientWidth-2*p.horizontalPadding;
  const availableHeight=clientHeight-2*p.verticalPadding;
  const widthByHeight=(availableHeight-p.transportHeight-frameExtra)/aspect;
  const widthByWidth=availableWidth-frameExtra-p.columnGap-p.minimumEditorWidth;
  const fits=widthByHeight>=p.minimumPreviewWidth && widthByWidth>=p.minimumPreviewWidth;
  // Keep the mandated minimum; native Window min constraints prevent undersizing.
  const previewWidth=Math.max(p.minimumPreviewWidth,Math.floor(Math.min(widthByHeight,widthByWidth)));
  const previewHeight=previewWidth*aspect;
  const frameWidth=previewWidth+frameExtra;
  const frameHeight=previewHeight+p.transportHeight+frameExtra;
  const editorWidth=Math.max(p.minimumEditorWidth,availableWidth-frameWidth-p.columnGap);
  return {previewWidth,previewHeight,frameWidth,frameHeight,editorWidth,minimumClientWidth,minimumClientHeight,fits};
}
