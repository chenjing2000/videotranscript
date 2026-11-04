/** Presentation-only scale: the MP4 layout always uses unscaled style values. */
export function previewEditorFontSize(fontSize: number, previewWidth: number, outputWidth: number): number {
  if (![fontSize, previewWidth, outputWidth].every(Number.isFinite) || fontSize <= 0 || previewWidth <= 0 || outputWidth <= 0)
    throw new Error('Invalid preview font scale inputs');
  return fontSize * previewWidth / outputWidth;
}

/** The preview keeps a visible media slot until real dimensions arrive. */
export function provisionalVideoHeight(outputWidth: number, outputHeight: number, ratio: number | null): number {
  const provisional = ratio !== null && Number.isFinite(ratio) && ratio > 0
    ? Math.round(outputWidth * ratio)
    : Math.round(outputWidth * 9 / 16);
  return Math.max(1, Math.min(outputHeight, provisional));
}

export function describeMediaError(code: number | undefined): string {
  switch (code) {
    case 1: return '媒体加载已中止';
    case 2: return '网络或资源读取失败';
    case 3: return '媒体解码失败（请检查视频/音频编码）';
    case 4: return '浏览器不支持该媒体源或编码格式';
    default: return '无法获取媒体信息';
  }
}

export function missingCompanionMessage(stem: string): string {
  return `找不到同名媒体文件：${['.mp4','.mkv','.mp3','.wav'].map(ext=>stem+ext).join('、')}。请确认文件与字幕 JSON 在同一文件夹。`;
}
