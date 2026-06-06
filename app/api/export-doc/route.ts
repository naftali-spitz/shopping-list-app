import { NextResponse } from "next/server";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

type ExportItem = string | { name: string; quantity?: number };
type ExportCategory = { name: string; items: ExportItem[] };
type ExportBody = { categories?: ExportCategory[]; items?: ExportItem[] };
type NormalizedItem = { name: string; quantity: number };
type NormalizedCategory = { name: string; items: NormalizedItem[] };
type Column = { lines: number; children: Paragraph[] };
type DocumentDirection = "ltr" | "rtl";
type ExportCopy = {
  locale: string;
  fallbackCategory: string;
  continued: string;
  title: string;
  summary: (formattedDate: string, itemCount: number, categoryCount: number) => string;
};

const MAX_COLUMNS = 4;
const TARGET_LINES_PER_COLUMN = 26;
const MIN_ITEMS_TO_START_CATEGORY = 3;
const RTL_CHARACTER = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;
const LETTER_CHARACTER = /\p{L}/u;

const EXPORT_COPY: Record<DocumentDirection, ExportCopy> = {
  ltr: {
    locale: "en-US",
    fallbackCategory: "General",
    continued: "continued",
    title: "🛒 FutureCart Shopping List",
    summary: (formattedDate, itemCount, categoryCount) =>
      `Created at: ${formattedDate} | ${itemCount} items in ${categoryCount} categories`,
  },
  rtl: {
    locale: "he-IL",
    fallbackCategory: "כללי",
    continued: "המשך",
    title: "🛒 FutureCart רשימת קניות",
    summary: (formattedDate, itemCount, categoryCount) =>
      `נוצר בתאריך: ${formattedDate} | ${itemCount} פריטים ב-${categoryCount} קטגוריות`,
  },
};

function normalizeItem(item: ExportItem): NormalizedItem | null {
  const name = typeof item === "string" ? item : item.name;
  if (typeof name !== "string" || !name.trim()) return null;
  const rawQuantity = typeof item === "string" ? 1 : Number(item.quantity || 1);
  const quantity = Number.isFinite(rawQuantity) ? Math.max(1, rawQuantity) : 1;
  return { name: name.trim(), quantity };
}

function normalizeCategories(body: ExportBody, fallbackCategory = "General"): NormalizedCategory[] {
  if (Array.isArray(body.categories)) {
    return body.categories
      .map((category) => ({
        name: typeof category?.name === "string" && category.name.trim() ? category.name.trim() : fallbackCategory,
        items: Array.isArray(category?.items)
          ? category.items.flatMap((item) => {
              const normalized = normalizeItem(item);
              return normalized ? [normalized] : [];
            })
          : [],
      }))
      .filter((category) => category.items.length > 0);
  }

  const fallbackItems = Array.isArray(body.items)
    ? body.items.flatMap((item) => {
        const normalized = normalizeItem(item);
        return normalized ? [normalized] : [];
      })
    : [];

  return fallbackItems.length ? [{ name: fallbackCategory, items: fallbackItems }] : [];
}

function estimateCategoryLines(category: NormalizedCategory, startIndex = 0) {
  return 1 + (category.items.length - startIndex) + 1;
}

function itemText(item: NormalizedItem) {
  return `☐ ${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`;
}

function getTextDirection(text: string): DocumentDirection | null {
  let rtlCharacters = 0;
  let ltrCharacters = 0;
  for (const character of text) {
    if (RTL_CHARACTER.test(character)) rtlCharacters += 1;
    else if (LETTER_CHARACTER.test(character)) ltrCharacters += 1;
  }
  if (rtlCharacters === ltrCharacters) return null;
  return rtlCharacters > ltrCharacters ? "rtl" : "ltr";
}

function getDocumentDirection(categories: NormalizedCategory[]): DocumentDirection {
  const directionCounts = categories.flatMap((category) => category.items).reduce(
    (counts, item) => {
      const direction = getTextDirection(item.name);
      if (direction) counts[direction] += 1;
      return counts;
    },
    { ltr: 0, rtl: 0 }
  );
  return directionCounts.rtl > directionCounts.ltr ? "rtl" : "ltr";
}

function paragraphDirection(direction: DocumentDirection) {
  return {
    alignment: direction === "rtl" ? AlignmentType.RIGHT : AlignmentType.LEFT,
    bidirectional: direction === "rtl",
  };
}

function textRunDirection(direction: DocumentDirection) {
  return { rightToLeft: direction === "rtl" };
}

function createTitleParagraph(copy: ExportCopy, direction: DocumentDirection) {
  return new Paragraph({
    ...paragraphDirection(direction),
    spacing: { after: 120 },
    children: [
      new TextRun({
        ...textRunDirection(direction),
        text: copy.title,
        bold: true,
        size: 34,
      }),
    ],
  });
}

function createSummaryParagraph(text: string, direction: DocumentDirection) {
  return new Paragraph({
    ...paragraphDirection(direction),
    spacing: { after: 240 },
    children: [
      new TextRun({
        ...textRunDirection(direction),
        text,
        italics: true,
        size: 20,
        color: "475569",
      }),
    ],
  });
}

function createFooterParagraph() {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    bidirectional: false,
    spacing: { before: 240 },
    children: [
      new TextRun({
        rightToLeft: false,
        text: "Generated by FutureCart",
        size: 18,
        color: "64748B",
      }),
    ],
  });
}

function createCategoryTitle(name: string, continued: boolean, direction: DocumentDirection, copy: ExportCopy) {
  return new Paragraph({
    ...paragraphDirection(direction),
    spacing: { before: 80, after: 80 },
    children: [
      new TextRun({
        ...textRunDirection(direction),
        text: continued ? `${name} - ${copy.continued}` : name,
        bold: true,
        size: 24,
        color: "0891B2",
      }),
    ],
  });
}

function createItemLine(item: NormalizedItem, direction: DocumentDirection) {
  return new Paragraph({
    ...paragraphDirection(direction),
    spacing: { after: 65 },
    children: [new TextRun({ ...textRunDirection(direction), text: itemText(item), size: 21 })],
  });
}

function createSpacerLine(direction: DocumentDirection) {
  return new Paragraph({
    ...paragraphDirection(direction),
    spacing: { after: 70 },
    children: [new TextRun({ ...textRunDirection(direction), text: "", size: 4 })],
  });
}

function addCategorySlice(column: Column, category: NormalizedCategory, startIndex: number, endIndex: number, direction: DocumentDirection, copy: ExportCopy) {
  column.children.push(createCategoryTitle(category.name, startIndex > 0, direction, copy));
  column.lines += 1;
  category.items.slice(startIndex, endIndex).forEach((item) => {
    column.children.push(createItemLine(item, direction));
    column.lines += 1;
  });
  column.children.push(createSpacerLine(direction));
  column.lines += 1;
}

function getColumnCount(totalLines: number) {
  return Math.min(MAX_COLUMNS, Math.max(1, Math.ceil(totalLines / TARGET_LINES_PER_COLUMN)));
}

function arrangeCategories(categories: NormalizedCategory[], direction: DocumentDirection, copy: ExportCopy) {
  const totalLines = categories.reduce((sum, category) => sum + estimateCategoryLines(category), 0);
  const columnCount = getColumnCount(totalLines);
  const columns: Column[] = Array.from({ length: columnCount }, () => ({ lines: 0, children: [] }));
  let columnIndex = 0;
  const moveToNextColumn = () => {
    if (columnIndex < columnCount - 1) columnIndex += 1;
  };

  categories.forEach((category) => {
    let itemIndex = 0;
    while (itemIndex < category.items.length) {
      const column = columns[columnIndex];
      const remainingItems = category.items.length - itemIndex;
      const fullRemainingLines = estimateCategoryLines(category, itemIndex);
      const availableLines = TARGET_LINES_PER_COLUMN - column.lines;
      const isLastColumn = columnIndex === columnCount - 1;

      if (!isLastColumn && availableLines <= 0) {
        moveToNextColumn();
        continue;
      }

      if (remainingItems <= MIN_ITEMS_TO_START_CATEGORY) {
        if (isLastColumn || fullRemainingLines <= availableLines) {
          addCategorySlice(column, category, itemIndex, category.items.length, direction, copy);
          itemIndex = category.items.length;
        } else {
          moveToNextColumn();
        }
        continue;
      }

      if (fullRemainingLines <= availableLines || isLastColumn) {
        addCategorySlice(column, category, itemIndex, category.items.length, direction, copy);
        itemIndex = category.items.length;
        continue;
      }

      const itemsThatCanFit = availableLines - 2;
      if (itemsThatCanFit < MIN_ITEMS_TO_START_CATEGORY) {
        moveToNextColumn();
        continue;
      }

      let endIndex = itemIndex + itemsThatCanFit;
      const itemsLeftForNextColumn = category.items.length - endIndex;
      if (itemsLeftForNextColumn > 0 && itemsLeftForNextColumn < MIN_ITEMS_TO_START_CATEGORY && itemsThatCanFit > MIN_ITEMS_TO_START_CATEGORY) {
        endIndex = category.items.length - MIN_ITEMS_TO_START_CATEGORY;
      }

      addCategorySlice(column, category, itemIndex, endIndex, direction, copy);
      itemIndex = endIndex;
      moveToNextColumn();
    }
  });

  return columns;
}

function createColumnTable(columns: Column[], direction: DocumentDirection) {
  const orderedColumns = direction === "rtl" ? [...columns].reverse() : columns;
  const emptyParagraph = new Paragraph({ ...paragraphDirection(direction), text: "" });

  return new Table({
    visuallyRightToLeft: direction === "rtl",
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: orderedColumns.map(
          (column) =>
            new TableCell({
              width: { size: 100 / orderedColumns.length, type: WidthType.PERCENTAGE },
              margins: { top: 120, right: 160, bottom: 120, left: 160 },
              borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
              },
              children: column.children.length ? column.children : [emptyParagraph],
            })
        ),
      }),
    ],
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ExportBody;
    let categories = normalizeCategories(body);
    if (!categories.length) return NextResponse.json({ error: "No items provided" }, { status: 400 });

    const direction = getDocumentDirection(categories);
    const copy = EXPORT_COPY[direction];
    categories = normalizeCategories(body, copy.fallbackCategory);

    const itemCount = categories.reduce((sum, category) => sum + category.items.length, 0);
    const formattedDate = new Intl.DateTimeFormat(copy.locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date());
    const columns = arrangeCategories(categories, direction, copy);

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: { orientation: PageOrientation.LANDSCAPE },
              margin: { top: 700, right: 620, bottom: 620, left: 620 },
            },
          },
          children: [
            createTitleParagraph(copy, direction),
            createSummaryParagraph(copy.summary(formattedDate, itemCount, categories.length), direction),
            createColumnTable(columns, direction),
            createFooterParagraph(),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="shopping-list.docx"',
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to generate document" }, { status: 500 });
  }
}
