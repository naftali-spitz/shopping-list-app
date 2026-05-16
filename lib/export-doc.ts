export async function exportShoppingDoc(items: string[]) {
  if (!items.length) {
    return null;
  }

  const createdAt = new Date().toISOString();

  const response = await fetch("/api/export-doc", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ items }),
  });

  if (!response.ok) {
    throw new Error("Failed to export document");
  }

  const blob = await response.blob();

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = `shopping-list-${createdAt.slice(0, 10)}.docx`;
  link.click();

  URL.revokeObjectURL(url);

  return createdAt;
}
