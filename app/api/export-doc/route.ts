import { NextResponse } from "next/server";
import {
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

type ExportItem =
  | string
  | {
      name: string;
      quantity?: number;
    };

type ExportCategory = {
  name: string;
  items: ExportItem[];
};

type NormalizedItem = {
  name: string;
  quantity: number;
};

type NormalizedCategory = {
  name: string;
  items: NormalizedItem[];
};

type Column = {
  lines: number;
  children: Paragraph[];
};

const MAX_COLUMNS = 4;
const TARGET_LINES_PER_COLUMN = 34;
const MIN_ITEMS_TO_START_CATEGORY = 3;

function normalizeItem(item: ExportItem): NormalizedItem | null {
  const name = typeof item === "string" ? item : item.name;

  if (typeof name !== "string" || !name.trim()) return null;

  const rawQuantity = typeof item === "string" ? 1 : Number(item.quantity || 1);
  const quantity = Number.isFinite(rawQuantity) ? Math.max(1, rawQuantity) : 1;

  return {
    name: name.trim(),
    quantity,
  };
}

function normalizeCategories(body: any): NormalizedCategory[] {
  if (Array.isArray(body.categories)) {
    return body.categories
      .map((category: ExportCategory) => ({
        name:
          typeof category?.name === "string" && category.name.trim()
            ? category.name.trim()
            : "כללי",
        items: Array.isArray(category?.items)
          ? category.items.flatMap((item) => {
              const normalized = normalizeItem(item);

              return normalized ? [normalized] : [];
            })
          : [],
      }))
      .filter((category: NormalizedCategory) => category.items.length > 0);
  }

  const fallbackItems = Array.isArray(body.items)
    ? body.items.flatMap((item: ExportItem) => {
        const normalized = normalizeItem(item);

        return normalized ? [normalized] : [];
      })
    : [];

  return fallbackItems.length
    ? [
        {
          name: "כללי",
          items: fallbackItems,
        },
      ]
    : [];
}

function estimateCategoryLines(category: NormalizedCategory, startIndex = 0) {
  return 1 + (category.items.length - startIndex) + 1;
}

function itemText(item: NormalizedItem) {
  return `☐ ${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`;
}

function createCategoryTitle(name: string, continued: boolean) {
  return new Paragraph({
    bidirectional: true,
    spacing: {
      before: 80,
      after: 80,
    },
    children: [
      new TextRun({
        text: continued ? `${name} - המשך` : name,
        bold: true,
        size: 24,
        color: "0891B2",
      }),
    ],
  });
}

function createItemLine(item: NormalizedItem) {
  return new Paragraph({
    bidirectional: true,
    spacing: {
      after: 65,
    },
    children: [
      new TextRun({
        text: itemText(item),
        size: 21,
      }),
    ],
  });
}

function createSpacerLine() {
  return new Paragraph({
    spacing: {
      after: 70,
    },
    children: [new TextRun({ text: "", size: 4 })],
  });
}

function addCategorySlice(
  column: Column,
  category: NormalizedCategory,
  startIndex: number,
  endIndex: number
) {
  column.children.push(createCategoryTitle(category.name, startIndex > 0));
  column.lines += 1;

  category.items.slice(startIndex, endIndex).forEach((item) => {
    column.children.push(createItemLine(item));
    column.lines += 1;
  });

  column.children.push(createSpacerLine());
  column.lines += 1;
}

function getColumnCount(totalLines: number) {
  return Math.min(
    MAX_COLUMNS,
    Math.max(1, Math.ceil(totalLines / TARGET_LINES_PER_COLUMN))
  );
}

function arrangeCategories(categories: NormalizedCategory[]) {
  const totalLines = categories.reduce(
    (sum, category) => sum + estimateCategoryLines(category),
    0
  );
  const columnCount = getColumnCount(totalLines);
  const columns: Column[] = Array.from({ length: columnCount }, () => ({
    lines: 0,
    children: [],
  }));

  let columnIndex = 0;

  const moveToNextColumn = () => {
    if (columnIndex < columnCount - 1) {
      columnIndex += 1;
    }
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
          addCategorySlice(column, category, itemIndex, category.items.length);
          itemIndex = category.items.length;
        } else {
          moveToNextColumn();
        }

        continue;
      }

      if (fullRemainingLines <= availableLines || isLastColumn) {
        addCategorySlice(column, category, itemIndex, category.items.length);
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

      if (
        itemsLeftForNextColumn > 0 &&
        itemsLeftForNextColumn < MIN_ITEMS_TO_START_CATEGORY &&
        itemsThatCanFit > MIN_ITEMS_TO_START_CATEGORY
      ) {
        endIndex = category.items.length - MIN_ITEMS_TO_START_CATEGORY;
      }

      addCategorySlice(column, category, itemIndex, endIndex);
      itemIndex = endIndex;
      moveToNextColumn();
    }
  });

  return columns;
}

function createColumnTable(columns: Column[]) {
  const emptyParagraph = new Paragraph({ text: "" });

  return new Table({
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    rows: [
      new TableRow({
        children: columns.map(
          (column) =>
            new TableCell({
              width: {
                size: 100 / columns.length,
                type: WidthType.PERCENTAGE,
              },
              margins: {
                top: 120,
                right: 160,
                bottom: 120,
                left: 160,
              },
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
    const body = await request.json();
    const categories = normalizeCategories(body);

    if (!categories.length) {
      return NextResponse.json(
        { error: "No items provided" },
        { status: 400 }
      );
    }

    const itemCount = categories.reduce(
      (sum, category) => sum + category.items.length,
      0
    );
    const formattedDate = new Intl.DateTimeFormat("he-IL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
    const columns = arrangeCategories(categories);

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: {
                orientation: PageOrientation.LANDSCAPE,
              },
              margin: {
                top: 700,
                right: 620,
                bottom: 620,
                left: 620,
              },
            },
          },
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              bidirectional: true,
              spacing: {
                after: 120,
              },
              children: [
                new TextRun({
                  text: "🛒 FutureCart רשימת קניות",
                  bold: true,
                  size: 34,
                }),
              ],
            }),
            new Paragraph({
              bidirectional: true,
              spacing: {
                after: 240,
              },
              children: [
                new TextRun({
                  text: `נוצר בתאריך: ${formattedDate} | ${itemCount} פריטים ב-${categories.length} קטגוריות`,
                  italics: true,
                  size: 20,
                  color: "475569",
                }),
              ],
            }),
            createColumnTable(columns),
            new Paragraph({
              bidirectional: true,
              spacing: {
                before: 240,
              },
              children: [
                new TextRun({
                  text: "Generated by FutureCart",
                  size: 18,
                  color: "64748B",
                }),
              ],
            }),
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

    return NextResponse.json(
      {
        error: "Failed to generate document",
      },
      {
        status: 500,
      }
    );
  }
}
