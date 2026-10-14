export function Loading({ text = '載入中…' }: { text?: string }) {
  return (
    <div className="status">
      <span className="spinner" />
      {text}
    </div>
  );
}

export function ErrorBox({ error }: { error: Error }) {
  return (
    <div className="status error">
      發生錯誤：{error.message}
      <button onClick={() => location.reload()}>重新整理</button>
    </div>
  );
}
